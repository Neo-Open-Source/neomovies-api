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
use vercel_runtime::{Response, ResponseBody};

use neomovies_api::handlers::{
    auth, favorites, health, images, media, players, search, support, torrents, webhook,
};

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

async fn route_film(Path(kp_id): Path<String>) -> AxumResponse {
    from_vercel(media::handle_film(&kp_id).await).await
}

async fn route_image_proxy(Query(params): Query<HashMap<String, String>>) -> AxumResponse {
    let url = params.get("url").map(|s| s.as_str()).unwrap_or("");
    from_vercel(images::handle_proxy(url).await).await
}

async fn route_image_kp(Path((kind, id)): Path<(String, String)>) -> AxumResponse {
    from_vercel(images::handle_kp(&kind, &id).await).await
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
    let _ = dotenvy::dotenv();

    match neomovies_api::Config::from_env() {
        Ok(_) => {}
        Err(e) => {
            eprintln!("Config error: {}", e);
            std::process::exit(1);
        }
    }

    match neomovies_api::db::get_db().await {
        Ok(_) => println!("MongoDB connected"),
        Err(e) => {
            eprintln!("MongoDB: {}", e);
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
        .route("/api/v1/movies/popular", get(route_popular))
        .route("/api/v1/movies/top-rated", get(route_top_rated))
        .route("/api/v1/movie/{kp_id}", get(route_film))
        .route("/api/v1/players/{provider}/kp/{kp_id}", get(route_player))
        .route("/api/v1/torrents/search", get(route_torrents))
        .route("/api/v1/favorites", get(route_favorites_list))
        .route("/api/v1/favorites/{kp_id}", post(route_favorites_add))
        .route("/api/v1/favorites/{kp_id}", delete(route_favorites_remove))
        .route("/api/v1/favorites/{kp_id}/check", get(route_favorites_check))
        .layer(cors);

    let port = std::env::var("LOCAL_SERVER_PORT")
        .or_else(|_| std::env::var("PORT"))
        .unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);

    println!("   NeoMovies API at http://localhost:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
