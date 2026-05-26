use crate::{bad_gateway, internal_error, json_response, with_cors, Config};
use crate::services::players::get_alloha_catalog;

pub async fn handle_catalog_by_kp(kp_id: u64) -> vercel_runtime::Response<vercel_runtime::ResponseBody> {
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };

    let token = config.alloha_token.as_deref().unwrap_or("");
    if token.is_empty() {
        return with_cors(internal_error());
    }

    match get_alloha_catalog(kp_id, token).await {
        Ok(payload) => with_cors(json_response(200, payload)),
        Err(err) => with_cors(bad_gateway(&err)),
    }
}

