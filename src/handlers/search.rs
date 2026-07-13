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

pub async fn handle_v2(params: &HashMap<String, String>) -> Response<ResponseBody> {
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);

    let page = params.get("page")
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(1);
    let genres = params.get("genres").map(|s| s.as_str());
    let countries = params.get("countries").map(|s| s.as_str());
    let order = params.get("order").map(|s| s.as_str());
    let film_type = params.get("type").map(|s| s.as_str());
    let rating_from = params.get("ratingFrom").and_then(|s| s.parse::<f64>().ok());
    let rating_to = params.get("ratingTo").and_then(|s| s.parse::<f64>().ok());
    let year_from = params.get("yearFrom").and_then(|s| s.parse::<i32>().ok());
    let year_to = params.get("yearTo").and_then(|s| s.parse::<i32>().ok());
    let keyword = params.get("keyword").map(|s| s.as_str());

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
