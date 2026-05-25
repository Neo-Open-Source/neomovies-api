/// Standalone HTTP server for local development.
///
/// Usage:
///   cargo run --bin server
///   PORT=8080 cargo run --bin server
///
/// Reads .env automatically. Mirrors all Vercel routes.

use axum::{
    Router,
    body::Body,
    extract::{Path, Query, Request as AxumRequest},
    http::StatusCode,
    response::Response as AxumResponse,
    routing::{delete, get, post, put},
};
use http_body_util::BodyExt;
use std::collections::HashMap;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::{DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse, TraceLayer};
use tracing::{error, info};
use tracing::Level;
use vercel_runtime::{Response, ResponseBody};

use neomovies_api::handlers::{
    auth, cdn_player, favorites, health, hls_proxy, images, media, players, search, support, torrents, webhook,
};

fn raw_q(query: &str, key: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        let k = it.next().unwrap_or("");
        if k == key {
            return Some(it.next().unwrap_or("").to_string());
        }
    }
    None
}

async fn from_vercel(resp: Response<ResponseBody>) -> AxumResponse {
    let (parts, body) = resp.into_parts();
    let status = StatusCode::from_u16(parts.status.as_u16()).unwrap_or(StatusCode::OK);
    let mut builder = axum::response::Response::builder().status(status);
    for (k, v) in &parts.headers {
        builder = builder.header(k, v);
    }
    let bytes = body
        .collect()
        .await
        .map(|c| c.to_bytes())
        .unwrap_or_default();
    builder.body(Body::from(bytes)).unwrap()
}

async fn route_health() -> AxumResponse {
    from_vercel(health::handle().await).await
}

async fn route_support() -> AxumResponse {
    from_vercel(support::handle().await).await
}

async fn route_search(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let query = params.get("query").map(|s| s.as_str()).unwrap_or("");
    let page: u32 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    from_vercel(search::handle(query, page).await).await
}

async fn route_popular(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let page: u32 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    from_vercel(media::handle_popular(page).await).await
}

async fn route_top_rated(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let page: u32 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    from_vercel(media::handle_top_rated(page).await).await
}

async fn route_tv_top_rated(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let page: u32 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    from_vercel(media::handle_top_rated_tv(page).await).await
}

async fn route_film(Path(kp_id): Path<String>) -> AxumResponse {
    from_vercel(media::handle_film(&kp_id).await).await
}

async fn route_tv_episode_description(
    Path((kp_id, season, episode)): Path<(String, u32, u32)>,
    Query(params): Query<HashMap<String, String>>,
) -> AxumResponse {
    let language = params.get("language").map(|s| s.as_str());
    from_vercel(media::handle_tv_episode_description(&kp_id, season, episode, language).await).await
}

async fn route_image_proxy(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let url = params.get("url").map(|s| s.as_str()).unwrap_or("");
    from_vercel(images::handle_proxy(url).await).await
}

async fn route_image_kp(Path((kind, id)): Path<(String, String)>) -> AxumResponse {
    from_vercel(images::handle_kp(&kind, &id).await).await
}

async fn route_image_screens(Path(kp_id): Path<String>, Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let season = params.get("season").and_then(|s| s.parse::<u32>().ok());
    let episode = params.get("episode").and_then(|s| s.parse::<u32>().ok());
    let size = params.get("size").map(|s| s.as_str());
    from_vercel(images::handle_screens_by_kp(&kp_id, season, episode, size).await).await
}

async fn route_image_screens_tv(Path((kp_id, season, episode)): Path<(String, u32, u32)>, Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let size = params.get("size").map(|s| s.as_str());
    from_vercel(images::handle_screens_by_kp(&kp_id, Some(season), Some(episode), size).await).await
}

async fn route_image_screens_tv_size(Path((kp_id, season, episode, size)): Path<(String, u32, u32, String)>) -> AxumResponse {
    from_vercel(images::handle_screens_by_kp(&kp_id, Some(season), Some(episode), Some(&size)).await).await
}

async fn route_image_backdrops(Path(kp_id): Path<String>, Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let size = params.get("size").map(|s| s.as_str());
    from_vercel(images::handle_backdrop_by_kp(&kp_id, size).await).await
}

async fn route_image_backdrops_size(Path((kp_id, size)): Path<(String, String)>) -> AxumResponse {
    from_vercel(images::handle_backdrop_by_kp(&kp_id, Some(&size)).await).await
}

async fn route_image_backdrops_page(Path(kp_id): Path<String>, Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let size = params.get("size").map(|s| s.as_str());
    from_vercel(images::handle_page_backdrop_by_kp(&kp_id, size).await).await
}

async fn route_image_backdrops_page_size(Path((kp_id, size)): Path<(String, String)>) -> AxumResponse {
    from_vercel(images::handle_page_backdrop_by_kp(&kp_id, Some(&size)).await).await
}

async fn route_image_logos(Path(kp_id): Path<String>, Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let size = params.get("size").map(|s| s.as_str());
    from_vercel(images::handle_logo_by_kp(&kp_id, size).await).await
}

async fn route_image_logos_size(Path((kp_id, size)): Path<(String, String)>) -> AxumResponse {
    from_vercel(images::handle_logo_by_kp(&kp_id, Some(&size)).await).await
}

async fn route_torrents(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let kp_id = params.get("kp_id").map(|s| s.as_str()).unwrap_or("");
    let season = params.get("season").and_then(|s| s.parse().ok());
    let episode = params.get("episode").and_then(|s| s.parse().ok());
    from_vercel(torrents::handle(kp_id, season, episode).await).await
}

async fn route_player(
    Path((provider, kp_id)): Path<(String, u64)>,
    Query(params): Query<HashMap<String, String>>,
) -> AxumResponse {
    let season = params.get("season").and_then(|s| s.parse().ok());
    let episode = params.get("episode").and_then(|s| s.parse().ok());
    from_vercel(players::handle(&provider, kp_id, season, episode).await).await
}

async fn route_cdn_player(
    Path(cdn_id): Path<u64>,
    Query(params): Query<HashMap<String, String>>,
) -> AxumResponse {
    let season = params.get("season").and_then(|s| s.parse().ok());
    let episode = params.get("episode").and_then(|s| s.parse().ok());
    from_vercel(cdn_player::handle(cdn_id, season, episode).await).await
}

async fn route_cdn_player_by_kp(
    Path(kp_id): Path<u64>,
    Query(params): Query<HashMap<String, String>>,
) -> AxumResponse {
    let season = params.get("season").and_then(|s| s.parse().ok());
    let episode = params.get("episode").and_then(|s| s.parse().ok());
    from_vercel(cdn_player::handle_by_kp(kp_id, season, episode).await).await
}

async fn route_hls_proxy(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let url = params.get("url").map(|s| s.as_str()).unwrap_or("");
    from_vercel(hls_proxy::handle_proxy(url).await).await
}

async fn route_webhook_neoid(req: AxumRequest) -> AxumResponse {
    let (_, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX)
        .await
        .unwrap_or_default();
    let body_str = String::from_utf8_lossy(&bytes).to_string();
    from_vercel(webhook::handle_neoid(&body_str).await).await
}

async fn route_auth_login(req: AxumRequest) -> AxumResponse {
    let (_, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX)
        .await
        .unwrap_or_default();
    from_vercel(auth::handle_login(&bytes).await).await
}

async fn route_auth_callback(req: AxumRequest) -> AxumResponse {
    let (_, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX)
        .await
        .unwrap_or_default();
    from_vercel(auth::handle_callback(&bytes).await).await
}

async fn route_auth_mobile_callback(req: AxumRequest) -> AxumResponse {
    let uri = req.uri().clone();
    let raw_query = uri.query().unwrap_or("");
    let params: HashMap<String, String> = url::form_urlencoded::parse(raw_query.as_bytes())
        .into_owned()
        .collect();
    let access_token = params.get("access_token").map(|s| s.as_str());
    let token = params.get("token").map(|s| s.as_str());
    let code = params.get("code").map(|s| s.as_str());
    let refresh_token = params.get("refresh_token").map(|s| s.as_str());
    let state = params.get("state").map(|s| s.as_str());
    let mobile_redirect_url = params.get("mobile_redirect_url").map(|s| s.as_str());
    let callback_url = raw_q(raw_query, "mobile_redirect_url").map(|raw_mobile_redirect| {
        format!(
            "https://api.neomovies.ru/api/v1/auth/neo-id/mobile-callback?mobile_redirect_url={}",
            raw_mobile_redirect
        )
    });
    from_vercel(auth::handle_mobile_callback_get(
        access_token,
        token,
        code,
        refresh_token,
        state,
        mobile_redirect_url,
        callback_url.as_deref(),
    ).await)
    .await
}

async fn route_auth_refresh(req: AxumRequest) -> AxumResponse {
    let (_, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX)
        .await
        .unwrap_or_default();
    from_vercel(auth::handle_refresh(&bytes).await).await
}

async fn route_auth_profile_get(req: AxumRequest) -> AxumResponse {
    let headers = req.headers().clone();
    from_vercel(auth::handle_profile_get(&headers).await).await
}

async fn route_auth_profile_put(req: AxumRequest) -> AxumResponse {
    let (parts, body) = req.into_parts();
    let headers = parts.headers;
    let bytes = axum::body::to_bytes(body, usize::MAX)
        .await
        .unwrap_or_default();
    from_vercel(auth::handle_profile_put(&headers, &bytes).await).await
}

async fn route_auth_revoke(req: AxumRequest) -> AxumResponse {
    let (parts, body) = req.into_parts();
    let headers = parts.headers;
    let bytes = axum::body::to_bytes(body, usize::MAX)
        .await
        .unwrap_or_default();
    from_vercel(auth::handle_revoke(&headers, &bytes).await).await
}

async fn route_auth_revoke_all(req: AxumRequest) -> AxumResponse {
    let headers = req.headers().clone();
    from_vercel(auth::handle_revoke_all(&headers).await).await
}

async fn route_auth_delete(req: AxumRequest) -> AxumResponse {
    let headers = req.headers().clone();
    from_vercel(auth::handle_delete(&headers).await).await
}

async fn route_favorites_list(req: AxumRequest) -> AxumResponse {
    let headers = req.headers().clone();
    from_vercel(favorites::handle_list(&headers).await).await
}

async fn route_favorites_add(
    Path(kp_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    req: AxumRequest,
) -> AxumResponse {
    let media_type = params.get("type").map(|s| s.as_str()).unwrap_or("movie");
    let headers = req.headers().clone();
    from_vercel(favorites::handle_add(&headers, &kp_id, media_type).await).await
}

async fn route_favorites_remove(
    Path(kp_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    req: AxumRequest,
) -> AxumResponse {
    let media_type = params.get("type").map(|s| s.as_str()).unwrap_or("movie");
    let headers = req.headers().clone();
    from_vercel(favorites::handle_remove(&headers, &kp_id, media_type).await).await
}

async fn route_favorites_check(
    Path(kp_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    req: AxumRequest,
) -> AxumResponse {
    let media_type = params.get("type").map(|s| s.as_str()).unwrap_or("movie");
    let headers = req.headers().clone();
    from_vercel(favorites::handle_check(&headers, &kp_id, media_type).await).await
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .with_target(false)
        .compact()
        .init();

    let _ = dotenvy::dotenv();

    match neomovies_api::Config::from_env() {
        Ok(_) => {}
        Err(e) => {
            error!("Config error: {}", e);
            std::process::exit(1);
        }
    }

    match neomovies_api::db::get_db().await {
        Ok(_) => println!("MongoDB connected"),
        Err(e) => {
            error!("MongoDB: {}", e);
            std::process::exit(1);
        }
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/v1/health", get(route_health))
        .route("/api/v1/support/list", get(route_support))
        .route("/api/v1/auth/neo-id/login", post(route_auth_login))
        .route("/api/v1/auth/neo-id/callback", post(route_auth_callback))
        .route("/api/v1/auth/neo-id/mobile-callback", get(route_auth_mobile_callback))
        .route("/api/v1/auth/refresh", post(route_auth_refresh))
        .route("/api/v1/auth/profile", get(route_auth_profile_get))
        .route("/api/v1/auth/profile", put(route_auth_profile_put))
        .route("/api/v1/auth/refresh-tokens/revoke", post(route_auth_revoke))
        .route("/api/v1/auth/refresh-tokens/revoke-all", post(route_auth_revoke_all))
        .route("/api/v1/auth/delete-account", delete(route_auth_delete))
        .route("/api/v1/webhooks/neo-id", post(route_webhook_neoid))
        .route("/api/v1/search", get(route_search))
        .route("/api/v1/images/proxy", get(route_image_proxy))
        .route("/api/v1/images/{kind}/{id}", get(route_image_kp))
        .route("/api/v1/images/screens/{kp_id}", get(route_image_screens))
        .route("/api/v1/images/screens/{kp_id}/{season}/{episode}", get(route_image_screens_tv))
        .route("/api/v1/images/screens/{kp_id}/{season}/{episode}/{size}", get(route_image_screens_tv_size))
        .route("/api/v1/images/backdrops/{kp_id}", get(route_image_backdrops))
        .route("/api/v1/images/backdrops/{kp_id}/{size}", get(route_image_backdrops_size))
        .route("/api/v1/images/backdrops/page/{kp_id}", get(route_image_backdrops_page))
        .route("/api/v1/images/backdrops/page/{kp_id}/{size}", get(route_image_backdrops_page_size))
        .route("/api/v1/images/logos/{kp_id}", get(route_image_logos))
        .route("/api/v1/images/logos/{kp_id}/{size}", get(route_image_logos_size))
        .route("/api/v1/movies/popular", get(route_popular))
        .route("/api/v1/movies/top-rated", get(route_top_rated))
        .route("/api/v1/tv/top-rated", get(route_tv_top_rated))
        .route("/api/v1/movie/{kp_id}", get(route_film))
        .route("/api/v1/tv/{kp_id}/season/{season}/episode/{episode}", get(route_tv_episode_description))
        .route("/api/v1/players/{provider}/kp/{kp_id}", get(route_player))
        .route("/api/v1/players/cdn/{cdn_id}", get(route_cdn_player))
        .route("/api/v1/players/cdn/kp/{kp_id}", get(route_cdn_player_by_kp))
        .route("/api/v1/hls/proxy", get(route_hls_proxy))
        .route("/api/v1/torrents/search", get(route_torrents))
        .route("/api/v1/favorites", get(route_favorites_list))
        .route("/api/v1/favorites/{kp_id}", post(route_favorites_add))
        .route("/api/v1/favorites/{kp_id}", delete(route_favorites_remove))
        .route("/api/v1/favorites/{kp_id}/check", get(route_favorites_check))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(cors);

    let port = std::env::var("LOCAL_SERVER_PORT")
        .or_else(|_| std::env::var("PORT"))
        .unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);

    info!("NeoMovies API at http://localhost:{}", port);
    println!("NeoMovies API at http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
