use crate::{Config, bad_gateway, bad_request, internal_error, success, with_cors};
use crate::services::JacredClient;
use vercel_runtime::{Response, ResponseBody};

pub async fn handle(kp_id_str: &str, season: Option<u32>, episode: Option<u32>) -> Response<ResponseBody> {
    let kp_id_raw = kp_id_str.trim();
    if kp_id_raw.is_empty() {
        return with_cors(bad_request("kp_id parameter is required"));
    }

    let normalized = kp_id_raw
        .strip_prefix("kp")
        .or_else(|| kp_id_raw.strip_prefix("KP"))
        .unwrap_or(kp_id_raw);

    let kp_id: u64 = match normalized.parse() {
        Ok(n) => n,
        Err(_) => return with_cors(bad_request("kp_id parameter is required")),
    };
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let base_url = match config.redapi_base_url {
        Some(u) => u,
        None => return with_cors(internal_error()),
    };
    let client = JacredClient::new(&base_url);
    match client.search_by_kp_id(kp_id, season, episode).await {
        Ok(results) => with_cors(success(results)),
        Err(e) if e.contains("unavailable") => with_cors(bad_gateway("torrent service unavailable")),
        Err(_) => with_cors(internal_error()),
    }
}
