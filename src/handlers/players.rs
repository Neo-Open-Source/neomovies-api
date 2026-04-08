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
    eprintln!(
        "[players][handler] request provider='{}' kp_id={} season={:?} episode={:?}",
        provider, kp_id, season, episode
    );
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(_) => {
            eprintln!("[players][handler] Config::from_env failed");
            return with_cors(internal_error());
        }
    };
    eprintln!(
        "[players][handler] config loaded: alloha={} lumex={} vibix_host={} vibix_token={} hdvb={} collaps_host={} collaps_token={}",
        config.alloha_token.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        config.lumex_url.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        config.vibix_host.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        config.vibix_token.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        config.hdvb_token.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        config.collaps_api_host.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        config.collaps_token.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
    );

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
        _ => {
            eprintln!("[players][handler] unsupported provider '{}'", provider);
            return with_cors(not_found("video not found"));
        }
    };

    with_cors(match result {
        Ok(html) => {
            eprintln!("[players][handler] success provider='{}' kp_id={}", provider, kp_id);
            html_response(html)
        }
        Err(e) => {
            eprintln!(
                "[players][handler] failed provider='{}' kp_id={} err='{}'",
                provider, kp_id, e
            );
            player_error(&e)
        }
    })
}
