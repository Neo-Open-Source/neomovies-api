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

// ── Search result item (for search endpoint) ─────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    pub id: String,
    pub title: String,
    pub original_title: String,
    pub year: Option<i32>,
    pub rating: f64,
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
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    async fn get<T: for<'de> Deserialize<'de>>(&self, url: &str) -> Result<T, String> {
        let resp = self
            .client
            .get(url)
            .header("X-API-KEY", &self.api_key)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("kp request failed: {}", e))?;

        let status = resp.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err("not_found".to_string());
        }
        if !status.is_success() {
            return Err(format!("upstream error: {}", status));
        }

        resp.json::<T>()
            .await
            .map_err(|e| format!("failed to parse kp response: {}", e))
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

    /// Get popular films collection.
    pub async fn get_popular(&self, page: u32) -> Result<SearchResponse, String> {
        self.get_collection("TOP_POPULAR_ALL", page).await
    }

    /// Get top-rated films collection.
    pub async fn get_top_rated(&self, page: u32) -> Result<SearchResponse, String> {
        self.get_collection("TOP_250_MOVIES", page).await
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
