use crate::{internal_error, not_found, success, with_cors};
use crate::services::cdn::{get_player_data, resolve_cdn_id_by_kp};
use vercel_runtime::{Response, ResponseBody};

pub async fn handle(cdn_id: u64, season: Option<u32>, episode: Option<u32>) -> Response<ResponseBody> {
    match get_player_data(cdn_id, season, episode).await {
        Ok(data) => with_cors(success(data)),
        Err(e) if e.contains("not found") || e.contains("no episodes") || e.contains("no video") => {
            with_cors(not_found("video not found"))
        }
        Err(e) => {
            eprintln!("cdn_player error (id={}): {}", cdn_id, e);
            with_cors(internal_error())
        }
    }
}

pub async fn handle_by_kp(kp_id: u64, season: Option<u32>, episode: Option<u32>) -> Response<ResponseBody> {
    let cdn_id = match resolve_cdn_id_by_kp(kp_id).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("cdn_player resolve error (kp={}): {}", kp_id, e);
            return with_cors(not_found("video not found"));
        }
    };
    handle(cdn_id, season, episode).await
}
