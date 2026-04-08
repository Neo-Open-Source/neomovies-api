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
