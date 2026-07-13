use std::collections::HashMap;

use crate::{Config, bad_gateway, bad_request, internal_error, is_empty_query, success, with_cors};
use crate::services::KinopoiskClient;
use vercel_runtime::{Response, ResponseBody};

pub async fn handle(query: &str, page: u32) -> Response<ResponseBody> {
    if is_empty_query(query) {
        return with_cors(bad_request("query parameter is required"));
    }
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    match kp.search_films(query, page).await {
        Ok(results) => with_cors(success(results)),
        Err(_) => with_cors(bad_gateway("upstream search failed")),
    }
}

fn resolve_ids(raw: Option<&str>, items: &[(i32, String)]) -> Option<String> {
    let raw = raw?;
    let ids: Vec<String> = raw.split(',')
        .filter_map(|name| {
            let name = name.trim();
            if name.parse::<i32>().is_ok() {
                return Some(name.to_string());
            }
            items.iter()
                .find(|(_, n)| n.eq_ignore_ascii_case(name))
                .map(|(id, _)| id.to_string())
        })
        .collect();
    if ids.is_empty() { None } else { Some(ids.join(",")) }
}

pub async fn handle_v2(params: &HashMap<String, String>) -> Response<ResponseBody> {
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);

    let page = params.get("page")
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(1);
    let order = params.get("order").map(|s| s.as_str());
    let film_type = params.get("type").map(|s| s.as_str());
    let rating_from = params.get("ratingFrom").and_then(|s| s.parse::<f64>().ok());
    let rating_to = params.get("ratingTo").and_then(|s| s.parse::<f64>().ok());
    let year_from = params.get("yearFrom").and_then(|s| s.parse::<i32>().ok());
    let year_to = params.get("yearTo").and_then(|s| s.parse::<i32>().ok());
    let keyword = params.get("keyword")
        .or_else(|| params.get("query"))
        .map(|s| s.as_str());

    // Resolve genre/country names to IDs (Kinopoisk API requires numeric IDs).
    let genres_raw = params.get("genres").map(|s| s.as_str());
    let countries_raw = params.get("countries").map(|s| s.as_str());
    let (genres_str, countries_str) = if genres_raw.is_some() || countries_raw.is_some() {
        match kp.get_filters().await {
            Ok(filters) => {
                let genre_items: Vec<(i32, String)> = filters.genres.into_iter()
                    .map(|g| (g.id, g.genre)).collect();
                let country_items: Vec<(i32, String)> = filters.countries.into_iter()
                    .map(|c| (c.id, c.country)).collect();
                (resolve_ids(genres_raw, &genre_items),
                 resolve_ids(countries_raw, &country_items))
            }
            Err(e) => {
                eprintln!("search_v2 filters fetch failed: {}", e);
                return with_cors(bad_gateway("upstream search failed"));
            }
        }
    } else {
        (None, None)
    };
    let genres = genres_str.as_deref();
    let countries = countries_str.as_deref();

    match kp.search_by_filters(
        genres, countries, order, film_type,
        rating_from, rating_to, year_from, year_to,
        keyword, page,
    ).await {
        Ok(results) => with_cors(success(results)),
        Err(e) => {
            eprintln!("search_v2 upstream error: {}", e);
            with_cors(bad_gateway("upstream search failed"))
        }
    }
}
