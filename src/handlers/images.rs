use crate::{bad_gateway, bad_request, not_found, with_cors};
use crate::services::tmdb::{MediaType, TmdbClient, TmdbError};
use crate::services::KinopoiskClient;
use crate::Config;
use serde_json::json;
use std::sync::OnceLock;
use vercel_runtime::{Response, ResponseBody};

// Reuse a single HTTP client across all image proxy requests.
// Creating a new client per request is expensive (TLS handshake setup, connection pool, etc.)
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .pool_max_idle_per_host(20)
            .tcp_keepalive(std::time::Duration::from_secs(60))
            .build()
            .expect("failed to build HTTP client")
    })
}

fn build_kp_image_url(kind: &str, id: &str) -> Option<String> {
    let is_valid_kind = matches!(kind, "kp" | "kp_small" | "kp_big");
    let is_valid_id = !id.is_empty() && id.chars().all(|c| c.is_ascii_digit());
    if !is_valid_kind || !is_valid_id {
        return None;
    }
    Some(format!(
        "https://kinopoiskapiunofficial.tech/images/posters/{}/{}.jpg",
        kind, id
    ))
}

fn decode_url_param(input: &str) -> String {
    let synthetic = format!("http://localhost/?url={}", input);
    if let Ok(url) = reqwest::Url::parse(&synthetic) {
        for (k, v) in url.query_pairs() {
            if k == "url" {
                return v.into_owned();
            }
        }
    }
    input.to_string()
}

pub async fn handle_proxy(url_param: &str) -> Response<ResponseBody> {
    let target_url = decode_url_param(url_param);
    let parsed = match reqwest::Url::parse(&target_url) {
        Ok(u) => u,
        Err(_) => return with_cors(bad_request("invalid url")),
    };
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return with_cors(bad_request("invalid url scheme"));
    }

    let resp = match get_client()
        .get(parsed)
        .header("User-Agent", "NeoMovies/2.0 (+https://neomovies.ru)")
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return with_cors(bad_gateway("upstream image error")),
    };

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return with_cors(not_found("image not found"));
    }
    if !resp.status().is_success() {
        return with_cors(bad_gateway("upstream image error"));
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    // Forward upstream caching hints so CDN/browsers can do conditional requests
    let etag = resp
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let last_modified = resp
        .headers()
        .get(reqwest::header::LAST_MODIFIED)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => return with_cors(bad_gateway("upstream image error")),
    };

    // Posters are static assets — cache aggressively: 30 days + immutable
    let mut builder = Response::builder()
        .status(200)
        .header("Content-Type", content_type)
        .header(
            "Cache-Control",
            "public, max-age=2592000, stale-while-revalidate=86400, immutable",
        );

    if let Some(etag) = etag {
        builder = builder.header("ETag", etag);
    }
    if let Some(lm) = last_modified {
        builder = builder.header("Last-Modified", lm);
    }

    let response = builder
        .body(ResponseBody::from(bytes.to_vec()))
        .unwrap();

    with_cors(response)
}

pub async fn handle_kp(kind: &str, id: &str) -> Response<ResponseBody> {
    let url = match build_kp_image_url(kind, id) {
        Some(u) => u,
        None => return with_cors(bad_request("invalid image path")),
    };
    handle_proxy(&url).await
}

fn parse_media_type(media_type: &str) -> Option<MediaType> {
    match media_type {
        "movie" => Some(MediaType::Movie),
        "tv" | "series" | "serial" => Some(MediaType::Tv),
        _ => None,
    }
}

fn map_tmdb_err(err: TmdbError) -> Response<ResponseBody> {
    match err {
        TmdbError::MissingApiKey => with_cors(bad_request("TMDB_API_KEY is not configured")),
        TmdbError::NotFound => with_cors(not_found("title not found")),
        TmdbError::Upstream(msg) => with_cors(bad_gateway(&format!("tmdb upstream error: {}", msg))),
    }
}

pub async fn handle_screens_resolve(title: &str, year: u32, media_type: &str) -> Response<ResponseBody> {
    if title.trim().is_empty() || year < 1900 {
        return with_cors(bad_request("invalid title or year"));
    }
    let media_type = match parse_media_type(media_type) {
        Some(mt) => mt,
        None => return with_cors(bad_request("invalid media type")),
    };
    let tmdb = match TmdbClient::from_env() {
        Ok(c) => c,
        Err(e) => return map_tmdb_err(e),
    };
    let lookup = match tmdb.find_by_title_year(title, year, media_type).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };
    let payload = json!({
        "tmdb_id": lookup.tmdb_id,
        "imdb_id": lookup.imdb_id,
        "proxy_url": format!("/api/v1/images/screens/{}", lookup.imdb_id),
    });
    with_cors(Response::builder()
        .status(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .body(ResponseBody::from(payload.to_string()))
        .unwrap())
}

pub async fn handle_screens_proxy(imdb_id: &str, media_type: &str, season: Option<u32>, episode: Option<u32>) -> Response<ResponseBody> {
    let media_type = match parse_media_type(media_type) {
        Some(mt) => mt,
        None => return with_cors(bad_request("invalid media type")),
    };
    if !imdb_id.starts_with("tt") || imdb_id.len() < 4 {
        return with_cors(bad_request("invalid imdb id"));
    }
    let (season, episode) = if matches!(media_type, MediaType::Tv) {
        (season.unwrap_or(1), episode.unwrap_or(1))
    } else {
        (0, 0)
    };

    let target = match media_type {
        MediaType::Movie => format!("https://images.metahub.space/poster/small/{imdb_id}/img"),
        MediaType::Tv => format!(
            "https://episodes.metahub.space/{}/{}/{}/w780.jpg",
            imdb_id,
            season,
            episode
        ),
    };
    handle_proxy(&target).await
}

pub async fn handle_backdrop_proxy(imdb_id: &str, media_type: &str, size: Option<&str>) -> Response<ResponseBody> {
    let media_type = match parse_media_type(media_type) {
        Some(mt) => mt,
        None => return with_cors(bad_request("invalid media type")),
    };
    if !imdb_id.starts_with("tt") || imdb_id.len() < 4 {
        return with_cors(bad_request("invalid imdb id"));
    }

    let tmdb = match TmdbClient::from_env() {
        Ok(c) => c,
        Err(e) => return map_tmdb_err(e),
    };
    let tmdb_id = match tmdb.find_tmdb_by_imdb(imdb_id, media_type).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };
    let file_path = match tmdb.media_backdrop_path(tmdb_id, media_type).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };
    let size = match normalize_size(size) {
        Some(s) => s,
        None => return with_cors(bad_request("invalid size")),
    };

    let target = format!("https://image.tmdb.org/t/p/{size}{file_path}");
    handle_proxy(&target).await
}


fn parse_year_from_release(release_date: &str) -> Option<u32> {
    release_date.get(0..4).and_then(|v| v.parse::<u32>().ok()).filter(|y| *y >= 1900)
}

async fn resolve_tmdb_id_with_fallback(
    tmdb: &TmdbClient,
    media_type: MediaType,
    imdb_id: Option<&str>,
    original_title: &str,
    title: &str,
    release_date: &str,
) -> Result<u64, TmdbError> {
    if let Some(imdb) = imdb_id.filter(|v| v.starts_with("tt") && v.len() > 3) {
        if let Ok(id) = tmdb.find_tmdb_by_imdb(imdb, media_type).await {
            return Ok(id);
        }
    }

    let year = parse_year_from_release(release_date).ok_or(TmdbError::NotFound)?;
    let mut candidates: Vec<(String, u32)> = Vec::new();
    for base in [original_title.trim(), title.trim()] {
        if base.is_empty() { continue; }
        candidates.push((base.to_string(), year));
        if year > 1900 { candidates.push((base.to_string(), year - 1)); }
        candidates.push((base.to_string(), year + 1));
    }

    for (q, y) in candidates {
        if let Ok(found) = tmdb.find_by_title_year(&q, y, media_type).await {
            return Ok(found.tmdb_id);
        }
    }

    Err(TmdbError::NotFound)
}

fn normalize_size(size: Option<&str>) -> Option<&'static str> {
    match size.unwrap_or("w780") {
        "small" => Some("w300"),
        "medium" => Some("w500"),
        "large" => Some("w780"),
        "xlarge" => Some("w1280"),
        "w300" => Some("w300"),
        "w500" => Some("w500"),
        "w780" => Some("w780"),
        "w1280" => Some("w1280"),
        "original" => Some("original"),
        _ => None,
    }
}

pub async fn handle_screens_by_kp(kp_id_str: &str, season: Option<u32>, episode: Option<u32>, size: Option<&str>) -> Response<ResponseBody> {
    let kp_id: u64 = match kp_id_str.parse() {
        Ok(v) => v,
        Err(_) => return with_cors(bad_request("invalid kp_id")),
    };

    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(bad_gateway("config error")),
    };

    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    let film = match kp.get_film(kp_id).await {
        Ok(v) => v,
        Err(e) if e.contains("not_found") => return with_cors(not_found("not found")),
        Err(_) => return with_cors(bad_gateway("kp upstream error")),
    };

    let media_kind = film.media_type.to_lowercase();
    let is_tv = matches!(media_kind.as_str(), "tv" | "tv-series" | "tv_series" | "series" | "serial");
    let media_type = if is_tv { MediaType::Tv } else { MediaType::Movie };
    let title = if !film.original_title.trim().is_empty() { film.original_title } else { film.title };
    let year = film
        .release_date
        .get(0..4)
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    if title.trim().is_empty() || year < 1900 {
        return with_cors(bad_request("could not resolve title/year from kp"));
    }

    let tmdb = match TmdbClient::from_env() {
        Ok(c) => c,
        Err(e) => return map_tmdb_err(e),
    };
    let lookup = match tmdb.find_by_title_year(&title, year, media_type).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };
    let size = match normalize_size(size) {
        Some(s) => s,
        None => return with_cors(bad_request("invalid size")),
    };

    let target = if is_tv {
        let s = season.unwrap_or(1);
        let e = episode.unwrap_or(1);
        format!("https://episodes.metahub.space/{}/{}/{}/{}.jpg", lookup.imdb_id, s, e, size)
    } else {
        let file_path = match tmdb.media_backdrop_path(lookup.tmdb_id, media_type).await {
            Ok(v) => v,
            Err(e) => return map_tmdb_err(e),
        };
        format!("https://image.tmdb.org/t/p/{size}{file_path}")
    };

    handle_proxy(&target).await
}

pub async fn handle_backdrop_by_kp(kp_id_str: &str, size: Option<&str>) -> Response<ResponseBody> {
    let kp_id: u64 = match kp_id_str.parse() {
        Ok(v) => v,
        Err(_) => return with_cors(bad_request("invalid kp_id")),
    };

    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(bad_gateway("config error")),
    };

    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    let film = match kp.get_film(kp_id).await {
        Ok(v) => v,
        Err(e) if e.contains("not_found") => return with_cors(not_found("not found")),
        Err(_) => return with_cors(bad_gateway("kp upstream error")),
    };

    let media_kind = film.media_type.to_lowercase();
    let is_tv = matches!(media_kind.as_str(), "tv" | "tv-series" | "tv_series" | "series" | "serial");
    let media_type = if is_tv { MediaType::Tv } else { MediaType::Movie };

    let tmdb = match TmdbClient::from_env() {
        Ok(c) => c,
        Err(e) => return map_tmdb_err(e),
    };

    let tmdb_id = match resolve_tmdb_id_with_fallback(
        &tmdb,
        media_type,
        film.external_ids.imdb.as_deref(),
        &film.original_title,
        &film.title,
        &film.release_date,
    ).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };

    let file_path = match tmdb.media_backdrop_path(tmdb_id, media_type).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };
    let size = match normalize_size(size) {
        Some(s) => s,
        None => return with_cors(bad_request("invalid size")),
    };
    let target = format!("https://image.tmdb.org/t/p/{size}{file_path}");
    handle_proxy(&target).await
}


pub async fn handle_page_backdrop_by_kp(kp_id_str: &str, size: Option<&str>) -> Response<ResponseBody> {
    let kp_id: u64 = match kp_id_str.parse() {
        Ok(v) => v,
        Err(_) => return with_cors(bad_request("invalid kp_id")),
    };
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(bad_gateway("config error")) };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    let film = match kp.get_film(kp_id).await {
        Ok(v) => v,
        Err(e) if e.contains("not_found") => return with_cors(not_found("not found")),
        Err(_) => return with_cors(bad_gateway("kp upstream error")),
    };
    let media_kind = film.media_type.to_lowercase();
    let is_tv = matches!(media_kind.as_str(), "tv" | "tv-series" | "tv_series" | "series" | "serial");
    let media_type = if is_tv { MediaType::Tv } else { MediaType::Movie };
    let tmdb = match TmdbClient::from_env() { Ok(c) => c, Err(e) => return map_tmdb_err(e) };
    let tmdb_id = match resolve_tmdb_id_with_fallback(
        &tmdb,
        media_type,
        film.external_ids.imdb.as_deref(),
        &film.original_title,
        &film.title,
        &film.release_date,
    ).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };
    let file_path = match tmdb.page_backdrop_path(tmdb_id, media_type).await { Ok(v) => v, Err(e) => return map_tmdb_err(e) };
    let size = match normalize_size(size) { Some(s) => s, None => return with_cors(bad_request("invalid size")) };
    let target = format!("https://image.tmdb.org/t/p/{size}{file_path}");
    handle_proxy(&target).await
}

pub async fn handle_logo_by_kp(kp_id_str: &str, size: Option<&str>) -> Response<ResponseBody> {
    let kp_id: u64 = match kp_id_str.parse() {
        Ok(v) => v,
        Err(_) => return with_cors(bad_request("invalid kp_id")),
    };
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(bad_gateway("config error")) };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    let film = match kp.get_film(kp_id).await {
        Ok(v) => v,
        Err(e) if e.contains("not_found") => return with_cors(not_found("not found")),
        Err(_) => return with_cors(bad_gateway("kp upstream error")),
    };
    let media_kind = film.media_type.to_lowercase();
    let is_tv = matches!(media_kind.as_str(), "tv" | "tv-series" | "tv_series" | "series" | "serial");
    let media_type = if is_tv { MediaType::Tv } else { MediaType::Movie };
    let tmdb = match TmdbClient::from_env() { Ok(c) => c, Err(e) => return map_tmdb_err(e) };
    let tmdb_id = match resolve_tmdb_id_with_fallback(
        &tmdb,
        media_type,
        film.external_ids.imdb.as_deref(),
        &film.original_title,
        &film.title,
        &film.release_date,
    ).await {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };
    let file_path = match tmdb.logo_path(tmdb_id, media_type).await { Ok(v) => v, Err(e) => return map_tmdb_err(e) };
    let logo_size = match size.unwrap_or("w500") {
        "small" | "w300" => "w300",
        "medium" | "large" | "w500" => "w500",
        "original" => "original",
        _ => return with_cors(bad_request("invalid size")),
    };
    let target = format!("https://image.tmdb.org/t/p/{logo_size}{file_path}");
    handle_proxy(&target).await
}
