use serde::Deserialize;

#[derive(Debug, Clone, Copy)]
pub enum MediaType {
    Movie,
    Tv,
}

impl MediaType {
    fn as_str(self) -> &'static str {
        match self {
            MediaType::Movie => "movie",
            MediaType::Tv => "tv",
        }
    }

    fn external_path(self, tmdb_id: u64) -> String {
        match self {
            MediaType::Movie => format!("movie/{}/external_ids", tmdb_id),
            MediaType::Tv => format!("tv/{}/external_ids", tmdb_id),
        }
    }

    fn images_path(self, tmdb_id: u64) -> String {
        match self {
            MediaType::Movie => format!("movie/{}/images", tmdb_id),
            MediaType::Tv => format!("tv/{}/images", tmdb_id),
        }
    }
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    results: Vec<SearchResult>,
}

#[derive(Debug, Deserialize)]
struct SearchResult {
    id: u64,
}

#[derive(Debug, Deserialize)]
struct ExternalIdsResponse {
    imdb_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ImagesResponse {
    backdrops: Option<Vec<ImageItem>>,
    logos: Option<Vec<ImageItem>>,
}

#[derive(Debug, Deserialize, Clone)]
struct ImageItem {
    file_path: Option<String>,
    iso_639_1: Option<String>,
    vote_average: Option<f64>,
    vote_count: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct TmdbLookup {
    pub tmdb_id: u64,
    pub imdb_id: String,
}

#[derive(Debug)]
pub enum TmdbError {
    MissingApiKey,
    NotFound,
    Upstream(String),
}

pub struct TmdbClient {
    base_url: String,
    api_key: String,
    client: reqwest::Client,
}

impl TmdbClient {
    pub fn from_env() -> Result<Self, TmdbError> {
        let api_key = std::env::var("TMDB_API_KEY").map_err(|_| TmdbError::MissingApiKey)?;
        Ok(Self {
            base_url: "https://api.themoviedb.org/3".to_string(),
            api_key,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .map_err(|e| TmdbError::Upstream(format!("client build: {}", e)))?,
        })
    }

    pub async fn find_by_title_year(
        &self,
        title: &str,
        year: u32,
        media_type: MediaType,
    ) -> Result<TmdbLookup, TmdbError> {
        let mut req = self
            .client
            .get(format!("{}/search/{}", self.base_url, media_type.as_str()))
            .query(&[("api_key", self.api_key.as_str()), ("query", title)]);

        let year_str = year.to_string();
        req = match media_type {
            MediaType::Movie => req.query(&[("year", year_str.as_str())]),
            MediaType::Tv => req.query(&[("first_air_date_year", year_str.as_str())]),
        };

        let search_resp = req
            .send()
            .await
            .map_err(|e| TmdbError::Upstream(format!("search send: {}", e)))?;
        if !search_resp.status().is_success() {
            let status = search_resp.status();
            let body = search_resp.text().await.unwrap_or_default();
            return Err(TmdbError::Upstream(format!("search status {} body {}", status, body)));
        }

        let search: SearchResponse = search_resp
            .json()
            .await
            .map_err(|e| TmdbError::Upstream(format!("search decode: {}", e)))?;
        let tmdb_id = search.results.first().map(|r| r.id).ok_or(TmdbError::NotFound)?;

        let ext_resp = self
            .client
            .get(format!("{}/{}", self.base_url, media_type.external_path(tmdb_id)))
            .query(&[("api_key", self.api_key.as_str())])
            .send()
            .await
            .map_err(|e| TmdbError::Upstream(format!("external_ids send: {}", e)))?;

        if !ext_resp.status().is_success() {
            let status = ext_resp.status();
            let body = ext_resp.text().await.unwrap_or_default();
            return Err(TmdbError::Upstream(format!(
                "external_ids status {} body {}",
                status, body
            )));
        }

        let ext: ExternalIdsResponse = ext_resp
            .json()
            .await
            .map_err(|e| TmdbError::Upstream(format!("external_ids decode: {}", e)))?;
        let imdb_id = ext
            .imdb_id
            .filter(|s| !s.trim().is_empty())
            .ok_or(TmdbError::NotFound)?;

        Ok(TmdbLookup { tmdb_id, imdb_id })
    }

    pub async fn find_tmdb_by_imdb(
        &self,
        imdb_id: &str,
        media_type: MediaType,
    ) -> Result<u64, TmdbError> {
        let resp = self
            .client
            .get(format!("{}/find/{}", self.base_url, imdb_id))
            .query(&[
                ("api_key", self.api_key.as_str()),
                ("external_source", "imdb_id"),
            ])
            .send()
            .await
            .map_err(|e| TmdbError::Upstream(format!("find send: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(TmdbError::Upstream(format!("find status {} body {}", status, body)));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| TmdbError::Upstream(format!("find decode: {}", e)))?;
        let key = match media_type {
            MediaType::Movie => "movie_results",
            MediaType::Tv => "tv_results",
        };

        let tmdb_id = body
            .get(key)
            .and_then(|arr| arr.as_array())
            .and_then(|arr| arr.first())
            .and_then(|obj| obj.get("id"))
            .and_then(|id| id.as_u64())
            .ok_or(TmdbError::NotFound)?;

        Ok(tmdb_id)
    }


    async fn images(&self, tmdb_id: u64, media_type: MediaType) -> Result<ImagesResponse, TmdbError> {
        self.images_with_filter(tmdb_id, media_type, None).await
    }

    async fn images_with_filter(
        &self,
        tmdb_id: u64,
        media_type: MediaType,
        include_image_language: Option<&str>,
    ) -> Result<ImagesResponse, TmdbError> {
        let mut req = self
            .client
            .get(format!("{}/{}", self.base_url, media_type.images_path(tmdb_id)))
            .query(&[("api_key", self.api_key.as_str())]);

        if let Some(v) = include_image_language {
            req = req.query(&[("include_image_language", v)]);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| TmdbError::Upstream(format!("images send: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(TmdbError::Upstream(format!("images status {} body {}", status, body)));
        }

        resp.json().await.map_err(|e| TmdbError::Upstream(format!("images decode: {}", e)))
    }

    fn pick_with_lang_priority(items: Vec<ImageItem>) -> Option<String> {
        let mut ru = Vec::new();
        let mut en = Vec::new();
        let mut any = Vec::new();
        for it in items {
            let path = it.file_path.clone().filter(|s| !s.trim().is_empty())?;
            let score = (it.vote_count.unwrap_or(0) as f64) * 10.0 + it.vote_average.unwrap_or(0.0);
            let lang = it.iso_639_1.unwrap_or_default().to_lowercase();
            if lang == "ru" { ru.push((score, path)); }
            else if lang == "en" { en.push((score, path)); }
            else { any.push((score, path)); }
        }
        let pick_best = |mut v: Vec<(f64,String)>| { v.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal)); v.into_iter().next().map(|x| x.1) };
        pick_best(ru).or_else(|| pick_best(en)).or_else(|| pick_best(any))
    }

    fn pick_best_any(items: Vec<ImageItem>) -> Option<String> {
        let mut v: Vec<(f64, String)> = items.into_iter().filter_map(|it| {
            let path = it.file_path.filter(|s| !s.trim().is_empty())?;
            let score = (it.vote_count.unwrap_or(0) as f64) * 10.0 + it.vote_average.unwrap_or(0.0);
            Some((score, path))
        }).collect();
        v.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        v.into_iter().next().map(|x| x.1)
    }

    pub async fn page_backdrop_path(&self, tmdb_id: u64, media_type: MediaType) -> Result<String, TmdbError> {
        let body = self.images(tmdb_id, media_type).await?;
        body.backdrops.and_then(Self::pick_with_lang_priority).ok_or(TmdbError::NotFound)
    }

    pub async fn media_backdrop_path(&self, tmdb_id: u64, media_type: MediaType) -> Result<String, TmdbError> {
        let null_only = self.images_with_filter(tmdb_id, media_type, Some("null")).await?;
        if let Some(path) = null_only.backdrops.and_then(Self::pick_best_any) {
            return Ok(path);
        }

        let body = self.images(tmdb_id, media_type).await?;
        body.backdrops.and_then(Self::pick_best_any).ok_or(TmdbError::NotFound)
    }

    pub async fn logo_path(&self, tmdb_id: u64, media_type: MediaType) -> Result<String, TmdbError> {
        let body = self.images(tmdb_id, media_type).await?;
        body.logos.and_then(Self::pick_with_lang_priority).ok_or(TmdbError::NotFound)
    }
}
