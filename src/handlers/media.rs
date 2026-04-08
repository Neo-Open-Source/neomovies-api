use crate::{Config, bad_gateway, bad_request, internal_error, not_found, success, with_cors};
use crate::services::KinopoiskClient;
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
        Err(_) => with_cors(bad_gateway("upstream error")),
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
        Err(_) => with_cors(bad_gateway("upstream error")),
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
        Ok(film) => with_cors(success(film)),
        Err(e) if e.contains("not_found") => with_cors(not_found("not found")),
        Err(_) => with_cors(bad_gateway("upstream error")),
    }
}
