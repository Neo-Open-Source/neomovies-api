use crate::{Config, internal_error, not_found, with_cors};
use crate::services::players::{
    get_alloha_player, get_collaps_player, get_hdvb_player, get_lumex_player, get_vibix_player,
};
use vercel_runtime::{Response, ResponseBody};

fn html_response(html: String) -> Response<ResponseBody> {
    Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(ResponseBody::from(html))
        .unwrap()
}

fn player_error(err: &str) -> Response<ResponseBody> {
    if err == "not_configured" { internal_error() } else { not_found("video not found") }
}

pub async fn handle(
    provider: &str,
    kp_id: u64,
    season: Option<u32>,
    episode: Option<u32>,
) -> Response<ResponseBody> {
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };

    let result = match provider {
        "alloha"  => get_alloha_player(
            kp_id,
            config.alloha_token.as_deref().unwrap_or(""),
            season,
            episode,
        ).await,
        "lumex"   => get_lumex_player(kp_id, config.lumex_url.as_deref().unwrap_or("")).await,
        "vibix"   => get_vibix_player(kp_id, config.vibix_host.as_deref().unwrap_or(""), config.vibix_token.as_deref().unwrap_or("")).await,
        "hdvb"    => get_hdvb_player(kp_id, config.hdvb_token.as_deref().unwrap_or("")).await,
        "collaps" => get_collaps_player(kp_id, config.collaps_api_host.as_deref().unwrap_or(""), config.collaps_token.as_deref().unwrap_or(""), season, episode).await,
        _ => return with_cors(not_found("video not found")),
    };

    with_cors(match result {
        Ok(html) => html_response(html),
        Err(e) => player_error(&e),
    })
}
