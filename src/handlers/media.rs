use crate::{Config, bad_gateway, bad_request, internal_error, not_found, service_unavailable_maintenance, success, with_cors};
use crate::services::kinopoisk::RatingsDto;
use crate::services::KinopoiskClient;
use crate::services::tmdb::{MediaType, TmdbClient, TmdbError};
use vercel_runtime::{Response, ResponseBody};

pub fn parse_kp_id(s: &str) -> Option<u64> {
    if let Some(stripped) = s.strip_prefix("kp_") {
        stripped.parse().ok()
    } else {
        s.parse().ok()
    }
}

pub async fn handle_popular(page: u32) -> Response<ResponseBody> {
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    match kp.get_popular(page).await {
        Ok(r) => with_cors(success(r)),
        Err(e) => {
            eprintln!("media_popular upstream error (page={}): {}", page, e);
            with_cors(service_unavailable_maintenance())
        }
    }
}

pub async fn handle_top_rated(page: u32) -> Response<ResponseBody> {
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    match kp.get_top_rated(page).await {
        Ok(r) => with_cors(success(r)),
        Err(e) => {
            eprintln!("media_top_rated upstream error (page={}): {}", page, e);
            with_cors(service_unavailable_maintenance())
        }
    }
}

pub async fn handle_top_rated_tv(page: u32) -> Response<ResponseBody> {
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    match kp.get_top_rated_tv(page).await {
        Ok(r) => with_cors(success(r)),
        Err(e) => {
            eprintln!("media_tv_top_rated upstream error (page={}): {}", page, e);
            with_cors(service_unavailable_maintenance())
        }
    }
}

pub async fn handle_film(kp_id_str: &str) -> Response<ResponseBody> {
    let id = match parse_kp_id(kp_id_str) {
        Some(n) => n,
        None => return with_cors(bad_request("invalid kp_id")),
    };
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    match kp.get_film(id).await {
        Ok(mut film) => {
            let media_kind = film.media_type.to_lowercase();
            let media_type = if matches!(media_kind.as_str(), "tv" | "tv-series" | "tv_series" | "series" | "serial") {
                MediaType::Tv
            } else {
                MediaType::Movie
            };

            if let Ok(tmdb) = TmdbClient::from_env() {
                if let Ok(tmdb_id) = resolve_tmdb_id_with_fallback(
                    &tmdb,
                    media_type,
                    film.external_ids.imdb.as_deref(),
                    &film.original_title,
                    &film.title,
                    &film.release_date,
                )
                .await
                {
                    film.external_ids.tmdb = Some(tmdb_id as i64);
                    if let Ok(tmdb_rating) = tmdb.media_tmdb_rating(tmdb_id, media_type).await {
                        film.ratings = RatingsDto {
                            kp: film.rating,
                            imdb: film.ratings.imdb,
                            tmdb: tmdb_rating,
                        };
                    }
                }
            }

            with_cors(success(film))
        }
        Err(e) if e.contains("not_found") => with_cors(not_found("not found")),
        Err(e) => {
            eprintln!("media_film upstream error (kp_id={}): {}", id, e);
            with_cors(service_unavailable_maintenance())
        }
    }
}

fn parse_year_from_release(release_date: &str) -> Option<u32> {
    release_date
        .get(0..4)
        .and_then(|v| v.parse::<u32>().ok())
        .filter(|y| *y >= 1900)
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
        if base.is_empty() {
            continue;
        }
        candidates.push((base.to_string(), year));
        if year > 1900 {
            candidates.push((base.to_string(), year - 1));
        }
        candidates.push((base.to_string(), year + 1));
    }

    for (q, y) in candidates {
        if let Ok(found) = tmdb.find_by_title_year(&q, y, media_type).await {
            return Ok(found.tmdb_id);
        }
    }

    Err(TmdbError::NotFound)
}

fn normalize_tmdb_language(language: Option<&str>) -> &'static str {
    match language.unwrap_or("ru-RU") {
        "ru" | "ru-RU" => "ru-RU",
        "en" | "en-US" => "en-US",
        _ => "ru-RU",
    }
}

fn map_tmdb_err(err: TmdbError) -> Response<ResponseBody> {
    match err {
        TmdbError::MissingApiKey => with_cors(bad_request("TMDB_API_KEY is not configured")),
        TmdbError::NotFound => with_cors(not_found("not found")),
        TmdbError::Upstream(_) => with_cors(bad_gateway("upstream error")),
    }
}

pub async fn handle_tv_episode_description(
    kp_id_str: &str,
    season: u32,
    episode: u32,
    language: Option<&str>,
) -> Response<ResponseBody> {
    let id = match parse_kp_id(kp_id_str) {
        Some(n) => n,
        None => return with_cors(bad_request("invalid kp_id")),
    };
    if season == 0 || episode == 0 {
        return with_cors(bad_request("invalid season or episode"));
    }

    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    let film = match kp.get_film(id).await {
        Ok(film) => film,
        Err(e) if e.contains("not_found") => return with_cors(not_found("not found")),
        Err(e) => {
            eprintln!("media_tv_episode_description film upstream error (kp_id={}): {}", id, e);
            return with_cors(service_unavailable_maintenance());
        }
    };

    let media_kind = film.media_type.to_lowercase();
    let is_tv = matches!(
        media_kind.as_str(),
        "tv" | "tv-series" | "tv_series" | "series" | "serial"
    );
    if !is_tv {
        return with_cors(bad_request("media is not tv"));
    }

    let tmdb = match TmdbClient::from_env() {
        Ok(c) => c,
        Err(e) => return map_tmdb_err(e),
    };
    let tmdb_id = match resolve_tmdb_id_with_fallback(
        &tmdb,
        MediaType::Tv,
        film.external_ids.imdb.as_deref(),
        &film.original_title,
        &film.title,
        &film.release_date,
    )
    .await
    {
        Ok(v) => v,
        Err(e) => return map_tmdb_err(e),
    };

    let lang = normalize_tmdb_language(language);
    match tmdb
        .tv_episode_description(tmdb_id, season, episode, lang)
        .await
    {
        Ok(mut data) => {
            data.ratings.imdb = film.ratings.imdb;
            with_cors(success(data))
        }
        Err(e) => map_tmdb_err(e),
    }
}
