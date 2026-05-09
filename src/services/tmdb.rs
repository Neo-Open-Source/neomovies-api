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
    backdrops: Option<Vec<BackdropItem>>,
}

#[derive(Debug, Deserialize)]
struct BackdropItem {
    file_path: Option<String>,
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

    pub async fn first_backdrop_path(
        &self,
        tmdb_id: u64,
        media_type: MediaType,
    ) -> Result<String, TmdbError> {
        let resp = self
            .client
            .get(format!("{}/{}", self.base_url, media_type.images_path(tmdb_id)))
            .query(&[("api_key", self.api_key.as_str())])
            .send()
            .await
            .map_err(|e| TmdbError::Upstream(format!("images send: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(TmdbError::Upstream(format!("images status {} body {}", status, body)));
        }

        let body: ImagesResponse = resp
            .json()
            .await
            .map_err(|e| TmdbError::Upstream(format!("images decode: {}", e)))?;

        body.backdrops
            .and_then(|arr| arr.into_iter().find_map(|b| b.file_path))
            .filter(|s| !s.trim().is_empty())
            .ok_or(TmdbError::NotFound)
    }
}
