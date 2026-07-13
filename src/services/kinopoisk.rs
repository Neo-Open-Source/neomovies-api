use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct KinopoiskClient {
    pub api_key: String,
    pub base_url: String,
    client: reqwest::Client,
}

// ── Raw KP API types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpFilm {
    pub kinopoisk_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub name_ru: Option<String>,
    pub name_en: Option<String>,
    pub name_original: Option<String>,
    pub poster_url: Option<String>,
    pub poster_url_preview: Option<String>,
    pub cover_url: Option<String>,
    pub rating_kinopoisk: Option<f64>,
    pub rating_imdb: Option<f64>,
    pub year: Option<i32>,
    pub film_length: Option<i32>,
    pub description: Option<String>,
    pub short_description: Option<String>,
    pub slogan: Option<String>,
    #[serde(rename = "type")]
    pub film_type: Option<String>,
    pub serial: Option<bool>,
    pub completed: Option<bool>,
    pub start_year: Option<i32>,
    pub end_year: Option<i32>,
    pub countries: Option<Vec<KpCountry>>,
    pub genres: Option<Vec<KpGenre>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct KpCountry {
    pub country: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct KpGenre {
    pub genre: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpFilmShort {
    pub kinopoisk_id: Option<i64>,
    pub film_id: Option<i64>,
    pub name_ru: Option<String>,
    pub name_en: Option<String>,
    pub name_original: Option<String>,
    pub imdb_id: Option<String>,
    pub poster_url: Option<String>,
    pub poster_url_preview: Option<String>,
    pub cover_url: Option<String>,
    pub rating_kinopoisk: Option<f64>,
    pub rating_imdb: Option<f64>,
    pub rating: Option<String>, // old format
    pub year: Option<Value>,    // FlexibleInt: can be int, string, or null
    pub description: Option<String>,
    pub countries: Option<Vec<KpCountry>>,
    pub genres: Option<Vec<KpGenre>>,
    #[serde(rename = "type")]
    pub film_type: Option<String>,
}

impl KpFilmShort {
    pub fn id(&self) -> i64 {
        self.kinopoisk_id.or(self.film_id).unwrap_or(0)
    }

    pub fn year_i32(&self) -> Option<i32> {
        match &self.year {
            Some(Value::Number(n)) => n.as_i64().map(|v| v as i32),
            Some(Value::String(s)) => s.parse().ok(),
            _ => None,
        }
    }

    pub fn rating_f64(&self) -> f64 {
        if let Some(r) = self.rating_kinopoisk {
            return r;
        }
        if let Some(s) = &self.rating {
            return s.parse().unwrap_or(0.0);
        }
        0.0
    }

    pub fn title(&self) -> String {
        self.name_ru
            .clone()
            .or_else(|| self.name_en.clone())
            .or_else(|| self.name_original.clone())
            .unwrap_or_default()
    }

    pub fn poster(&self) -> String {
        self.poster_url_preview
            .clone()
            .or_else(|| self.poster_url.clone())
            .unwrap_or_default()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KpSearchResponse {
    pages_count: Option<i32>,
    films: Option<Vec<KpFilmShort>>,
    search_films_count_result: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KpCollectionResponse {
    total: Option<i32>,
    total_pages: Option<i32>,
    items: Option<Vec<KpFilmShort>>,
    // old format fallback
    pages_count: Option<i32>,
    films: Option<Vec<KpFilmShort>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpFilterSearchResponse {
    pub total: i32,
    pub total_pages: i32,
    pub items: Vec<KpFilmFilterItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpFilmFilterItem {
    pub kinopoisk_id: i64,
    pub imdb_id: Option<String>,
    pub name_ru: Option<String>,
    pub name_en: Option<String>,
    pub name_original: Option<String>,
    pub countries: Option<Vec<KpCountry>>,
    pub genres: Option<Vec<KpGenre>>,
    pub rating_kinopoisk: Option<f64>,
    #[serde(alias = "ratingImbd")]
    pub rating_imdb: Option<f64>,
    pub year: Option<i32>,
    #[serde(rename = "type")]
    pub film_type: Option<String>,
    pub poster_url: String,
    pub poster_url_preview: String,
}

impl KpFilmFilterItem {
    pub fn id(&self) -> i64 {
        self.kinopoisk_id
    }

    pub fn title(&self) -> String {
        self.name_ru
            .clone()
            .or_else(|| self.name_en.clone())
            .or_else(|| self.name_original.clone())
            .unwrap_or_default()
    }

    pub fn poster(&self) -> String {
        if !self.poster_url_preview.is_empty() {
            self.poster_url_preview.clone()
        } else {
            self.poster_url.clone()
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpFiltersResponse {
    pub genres: Vec<KpGenreItem>,
    pub countries: Vec<KpCountryItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpGenreItem {
    pub id: i32,
    pub genre: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpCountryItem {
    pub id: i32,
    pub country: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenreCatalogDto {
    pub id: i32,
    pub name: String,
}

// ── Unified MediaDetailsDto ───────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDetailsDto {
    pub id: String,
    pub source_id: String,
    pub title: String,
    pub original_title: String,
    pub description: String,
    pub release_date: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub genres: Vec<GenreDto>,
    pub rating: f64,
    pub ratings: RatingsDto,
    pub poster_url: String,
    pub backdrop_url: String,
    pub duration: i32,
    pub country: String,
    pub language: String,
    pub external_ids: ExternalIdsDto,
}

#[derive(Debug, Serialize)]
pub struct GenreDto {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct ExternalIdsDto {
    pub kp: Option<i64>,
    pub tmdb: Option<i64>,
    pub imdb: Option<String>,
}

// ── V2 MediaDetailsDto (cleaner response) ─────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDetailsV2Dto {
    pub id: String,
    pub title: String,
    pub original_title: String,
    pub description: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub year: Option<i32>,
    pub release_date: Option<String>,
    pub genres: Vec<String>,
    pub countries: Vec<String>,
    pub duration: i32,
    pub poster: String,
    pub backdrop: String,
    pub ratings: RatingsV2Dto,
    pub ids: IdsDto,
}

#[derive(Debug, Serialize)]
pub struct RatingsV2Dto {
    pub kp: f64,
    pub imdb: Option<f64>,
    pub tmdb: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct IdsDto {
    pub kp: i64,
    pub imdb: Option<String>,
    pub tmdb: Option<i64>,
}

// ── Search result item (for search endpoint) ─────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    pub id: String,
    pub title: String,
    pub original_title: String,
    pub year: Option<i32>,
    pub rating: f64,
    pub ratings: RatingsDto,
    pub poster_url: String,
    pub genres: Vec<GenreDto>,
    pub description: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub external_ids: ExternalIdsDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub results: Vec<SearchResultItem>,
    pub total: i32,
    pub pages: i32,
}

#[derive(Debug, Serialize)]
pub struct RatingsDto {
    pub kp: f64,
    pub imdb: Option<f64>,
    pub tmdb: Option<f64>,
}

fn to_local_image_path(url: &str, default_kind: &str) -> String {
    if url.is_empty() {
        return String::new();
    }
    if url.starts_with("/api/v1/images/") {
        return url.to_string();
    }
    if url.starts_with("/images/") {
        return format!("/api/v1{}", url);
    }
    if let Some(idx) = url.find("/images/posters/") {
        let tail = &url[idx + "/images/posters/".len()..];
        let parts: Vec<&str> = tail.split('/').collect();
        if parts.len() >= 2 {
            let kind = if parts[0].is_empty() { default_kind } else { parts[0] };
            let id = parts[1].trim_end_matches(".jpg");
            if !id.is_empty() {
                return format!("/api/v1/images/{}/{}", kind, id);
            }
        }
    }
    url.to_string()
}

// ── Client implementation ─────────────────────────────────────────────────────

impl KinopoiskClient {
    pub fn new(api_key: &str, base_url: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            base_url: base_url.trim_end_matches('/').to_string(),
            client: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(4))
                .timeout(std::time::Duration::from_secs(15))
                .user_agent("neomovies-api/1.0 (+https://api.neome.uk)")
                .build()
                .unwrap(),
        }
    }

    async fn get<T: for<'de> Deserialize<'de>>(&self, url: &str) -> Result<T, String> {
        let mut last_err = String::from("kp request failed");

        for attempt in 1..=2 {
            let resp = self
                .client
                .get(url)
                .header("X-API-KEY", &self.api_key)
                .header("Accept", "application/json")
                .send()
                .await;

            let resp = match resp {
                Ok(v) => v,
                Err(e) => {
                    last_err = format!("kp request failed (attempt {}): {}", attempt, e);
                    if attempt < 2 && (e.is_timeout() || e.is_connect()) {
                        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                        continue;
                    }
                    return Err(last_err);
                }
            };

            let status = resp.status();
            if status == reqwest::StatusCode::NOT_FOUND {
                return Err("not_found".to_string());
            }
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                let body_snippet: String = body.chars().take(300).collect();
                last_err = format!(
                    "kp upstream status {} (attempt {}): {}",
                    status, attempt, body_snippet
                );
                if attempt < 2
                    && (status == reqwest::StatusCode::TOO_MANY_REQUESTS || status.is_server_error())
                {
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    continue;
                }
                return Err(last_err);
            }

            return resp
                .json::<T>()
                .await
                .map_err(|e| format!("failed to parse kp response: {}", e));
        }

        Err(last_err)
    }

    /// Search films by keyword. Returns SearchResponse.
    pub async fn search_films(&self, query: &str, page: u32) -> Result<SearchResponse, String> {
        let encoded_query: String = query
            .chars()
            .flat_map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
                    vec![c]
                } else {
                    let mut buf = [0u8; 4];
                    let s = c.encode_utf8(&mut buf);
                    s.bytes().flat_map(|b| {
                        format!("%{:02X}", b).chars().collect::<Vec<_>>()
                    }).collect()
                }
            })
            .collect();
        let url = format!(
            "{}/v2.1/films/search-by-keyword?keyword={}&page={}",
            self.base_url,
            encoded_query,
            page
        );
        let raw: KpSearchResponse = self.get(&url).await?;
        let films = raw.films.unwrap_or_default();
        let total = raw.search_films_count_result.unwrap_or(films.len() as i32);
        let pages = raw.pages_count.unwrap_or(1);

        let results = films
            .into_iter()
            .map(map_short_to_search_item)
            .filter(|item| item.rating > 0.0)
            .collect();
        Ok(SearchResponse { results, total, pages })
    }

    /// Get film details by KP ID. Returns MediaDetailsDto.
    pub async fn get_film(&self, kp_id: u64) -> Result<MediaDetailsDto, String> {
        let url = format!("{}/v2.2/films/{}", self.base_url, kp_id);
        let film: KpFilm = self.get(&url).await?;
        Ok(map_film_to_dto(film))
    }

    /// Fetch raw KpFilm for custom mapping (used by v2 detail).
    pub async fn get_film_raw(&self, kp_id: u64) -> Result<KpFilm, String> {
        let url = format!("{}/v2.2/films/{}", self.base_url, kp_id);
        self.get(&url).await
    }

    /// Search films by filters (genres, year, rating, order, etc.)
    /// Wraps GET /api/v2.2/films
    #[allow(clippy::too_many_arguments)]
    pub async fn search_by_filters(
        &self,
        genres: Option<&str>,
        countries: Option<&str>,
        order: Option<&str>,
        film_type: Option<&str>,
        rating_from: Option<f64>,
        rating_to: Option<f64>,
        year_from: Option<i32>,
        year_to: Option<i32>,
        keyword: Option<&str>,
        page: u32,
    ) -> Result<SearchResponse, String> {
        let mut params: Vec<(String, String)> = Vec::new();
        if let Some(v) = genres { params.push(("genres".into(), v.to_string())); }
        if let Some(v) = countries { params.push(("countries".into(), v.to_string())); }
        if let Some(v) = order { params.push(("order".into(), v.to_string())); }
        if let Some(v) = film_type { params.push(("type".into(), v.to_string())); }
        if let Some(v) = rating_from { params.push(("ratingFrom".into(), v.to_string())); }
        if let Some(v) = rating_to { params.push(("ratingTo".into(), v.to_string())); }
        if let Some(v) = year_from { params.push(("yearFrom".into(), v.to_string())); }
        if let Some(v) = year_to { params.push(("yearTo".into(), v.to_string())); }
        if let Some(v) = keyword { params.push(("keyword".into(), v.to_string())); }
        params.push(("page".into(), page.to_string()));

        let qs = params.iter()
            .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
            .collect::<Vec<_>>()
            .join("&");

        let url = format!("{}/v2.2/films?{}", self.base_url, qs);
        let raw: KpFilterSearchResponse = self.get(&url).await?;

        let total = raw.total;
        let pages = raw.total_pages;
        let results = raw.items
            .into_iter()
            .map(|f| {
                let kp_id = f.id();
                let id = format!("kp_{}", kp_id);
                let title = f.title();
                let original_title = f.name_original.clone().or_else(|| f.name_en.clone()).unwrap_or_default();
                let year = f.year;
                let rating = f.rating_kinopoisk.unwrap_or(0.0);
                let poster_url = to_local_image_path(&f.poster(), "kp_small");
                let description = String::new();
                let media_type = map_kp_type(&f.film_type, None);
                let genres_dto = f.genres.unwrap_or_default().into_iter().map(|g| GenreDto {
                    id: g.genre.to_lowercase(),
                    name: g.genre,
                }).collect();

                SearchResultItem {
                    id,
                    title,
                    original_title,
                    year,
                    rating,
                    ratings: RatingsDto { kp: rating, imdb: f.rating_imdb, tmdb: None },
                    poster_url,
                    genres: genres_dto,
                    description,
                    media_type,
                    external_ids: ExternalIdsDto { kp: Some(kp_id), tmdb: None, imdb: f.imdb_id },
                }
            })
            .collect();

        Ok(SearchResponse { results, total, pages })
    }

    /// Get list of available genres and countries (filters).
    pub async fn get_filters(&self) -> Result<KpFiltersResponse, String> {
        let url = format!("{}/v2.2/films/filters", self.base_url);
        self.get(&url).await
    }

    /// Get films by genre ID.
    pub async fn get_by_genre(
        &self,
        genre_id: i32,
        film_type: Option<&str>,
        order: Option<&str>,
        page: u32,
    ) -> Result<SearchResponse, String> {
        self.search_by_filters(
            Some(&genre_id.to_string()),
            None, order, film_type,
            None, None, None, None,
            None, page,
        ).await
    }

    /// Get popular films collection.
    pub async fn get_popular(&self, page: u32) -> Result<SearchResponse, String> {
        self.get_collection("TOP_POPULAR_ALL", page).await
    }

    /// Get top-rated films collection.
    pub async fn get_top_rated(&self, page: u32) -> Result<SearchResponse, String> {
        self.get_collection("TOP_250_MOVIES", page).await
    }

    /// Get top-rated TV series collection.
    pub async fn get_top_rated_tv(&self, page: u32) -> Result<SearchResponse, String> {
        self.get_collection("TOP_250_TV_SHOWS", page).await
    }

    async fn get_collection(&self, collection_type: &str, page: u32) -> Result<SearchResponse, String> {
        let url = format!(
            "{}/v2.2/films/collections?type={}&page={}",
            self.base_url, collection_type, page
        );
        let raw: KpCollectionResponse = self.get(&url).await?;

        // Prefer new format (items), fall back to old (films)
        let films = raw.items.or(raw.films).unwrap_or_default();
        let total = raw.total.unwrap_or(films.len() as i32);
        let pages = raw.total_pages.or(raw.pages_count).unwrap_or(1);

        let results = films
            .into_iter()
            .map(map_short_to_search_item)
            .filter(|item| item.rating > 0.0)
            .collect();
        Ok(SearchResponse { results, total, pages })
    }
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

fn map_film_to_dto(f: KpFilm) -> MediaDetailsDto {
    let kp_id = f.kinopoisk_id.unwrap_or(0);
    let id = format!("kp_{}", kp_id);

    let title = f.name_ru
        .clone()
        .or_else(|| f.name_en.clone())
        .or_else(|| f.name_original.clone())
        .unwrap_or_default();

    let original_title = f.name_original
        .clone()
        .or_else(|| f.name_en.clone())
        .unwrap_or_default();

    let description = f.description
        .or(f.short_description)
        .unwrap_or_default();

    let year = f.year.or(f.start_year).unwrap_or(0);
    let release_date = if year > 0 { format!("{}-01-01", year) } else { String::new() };

    let media_type = map_kp_type(&f.film_type, f.serial);

    let genres = f.genres.unwrap_or_default().into_iter().map(|g| GenreDto {
        id: g.genre.to_lowercase(),
        name: g.genre,
    }).collect();

    let rating = f.rating_kinopoisk.unwrap_or(0.0);

    let poster_url_raw = f.poster_url_preview
        .or(f.poster_url)
        .unwrap_or_default();
    let poster_url = to_local_image_path(&poster_url_raw, "kp_small");

    let backdrop_url = to_local_image_path(
        &f.cover_url.unwrap_or_else(|| poster_url_raw.clone()),
        "kp_big",
    );

    let duration = f.film_length.unwrap_or(0);

    let country = f.countries
        .as_deref()
        .and_then(|c| c.first())
        .map(|c| c.country.clone())
        .unwrap_or_default();

    let language = if f.name_ru.is_some() { "ru".to_string() } else { "en".to_string() };

    MediaDetailsDto {
        source_id: id.clone(),
        id,
        title,
        original_title,
        description,
        release_date,
        media_type,
        genres,
        rating,
        ratings: RatingsDto {
            kp: rating,
            imdb: f.rating_imdb,
            tmdb: None,
        },
        poster_url,
        backdrop_url,
        duration,
        country,
        language,
        external_ids: ExternalIdsDto {
            kp: Some(kp_id),
            tmdb: None,
            imdb: f.imdb_id,
        },
    }
}

pub fn map_film_to_v2_dto(f: KpFilm) -> MediaDetailsV2Dto {
    let kp_id = f.kinopoisk_id.unwrap_or(0);
    let id = format!("kp_{}", kp_id);

    let title = f.name_ru
        .clone()
        .or_else(|| f.name_en.clone())
        .or_else(|| f.name_original.clone())
        .unwrap_or_default();

    let original_title = f.name_original
        .clone()
        .or_else(|| f.name_en.clone())
        .unwrap_or_default();

    let description = f.description
        .or(f.short_description)
        .unwrap_or_default();

    let year = f.year.or(f.start_year);
    let release_date = f.year.map(|y| format!("{}-01-01", y))
        .or_else(|| f.start_year.map(|y| format!("{}-01-01", y)));

    let media_type = map_kp_type(&f.film_type, f.serial);

    let genres: Vec<String> = f.genres
        .unwrap_or_default()
        .into_iter()
        .map(|g| g.genre)
        .collect();

    let countries: Vec<String> = f.countries
        .unwrap_or_default()
        .into_iter()
        .map(|c| c.country)
        .collect();

    let rating = f.rating_kinopoisk.unwrap_or(0.0);

    let poster_raw = f.poster_url_preview
        .or(f.poster_url)
        .unwrap_or_default();
    let poster = to_local_image_path(&poster_raw, "kp_small");
    let backdrop = to_local_image_path(
        &f.cover_url.unwrap_or_else(|| poster_raw),
        "kp_big",
    );

    let duration = f.film_length.unwrap_or(0);

    MediaDetailsV2Dto {
        id,
        title,
        original_title,
        description,
        media_type,
        year,
        release_date,
        genres,
        countries,
        duration,
        poster,
        backdrop,
        ratings: RatingsV2Dto {
            kp: rating,
            imdb: f.rating_imdb,
            tmdb: None,
        },
        ids: IdsDto {
            kp: kp_id,
            imdb: f.imdb_id,
            tmdb: None,
        },
    }
}

fn map_short_to_search_item(f: KpFilmShort) -> SearchResultItem {
    let kp_id = f.id();
    let id = format!("kp_{}", kp_id);
    let title = f.title();
    let original_title = f.name_original.clone().or_else(|| f.name_en.clone()).unwrap_or_default();
    let year = f.year_i32();
    let rating = f.rating_f64();
    let poster_url = to_local_image_path(&f.poster(), "kp_small");
    let description = f.description.clone().unwrap_or_default();
    let media_type = map_kp_type(&f.film_type, None);

    let genres = f.genres.unwrap_or_default().into_iter().map(|g| GenreDto {
        id: g.genre.to_lowercase(),
        name: g.genre,
    }).collect();

    SearchResultItem {
        id,
        title,
        original_title,
        year,
        rating,
        ratings: RatingsDto {
            kp: rating,
            imdb: f.rating_imdb,
            tmdb: None,
        },
        poster_url,
        genres,
        description,
        media_type,
        external_ids: ExternalIdsDto {
            kp: Some(kp_id),
            tmdb: None,
            imdb: f.imdb_id,
        },
    }
}

fn map_kp_type(film_type: &Option<String>, serial: Option<bool>) -> String {
    if serial == Some(true) {
        return "tv".to_string();
    }
    match film_type.as_deref() {
        Some("TV_SERIES") | Some("MINI_SERIES") | Some("TV_SHOW") => "tv".to_string(),
        _ => "movie".to_string(),
    }
}
