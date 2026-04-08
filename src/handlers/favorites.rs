use mongodb::bson::{DateTime, doc};
use futures_util::TryStreamExt;
use http::HeaderMap;
use mongodb::options::UpdateOptions;
use serde::Serialize;
use serde_json::json;
use vercel_runtime::{Response, ResponseBody};

use crate::{
    Config, bad_request, internal_error, not_found, success, with_cors,
    auth::middleware::require_auth_headers,
    models::favorite::{collection, ensure_indexes, Favorite},
    services::KinopoiskClient,
};

type VResp = Response<ResponseBody>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteDto {
    pub id: String,
    pub media_id: String,
    pub media_type: String,
    pub title: String,
    pub poster_url: String,
    pub rating: Option<f64>,
    pub year: Option<i32>,
    pub created_at: String,
}

fn to_dto(f: Favorite) -> FavoriteDto {
    FavoriteDto {
        id: f.id.map(|id| id.to_hex()).unwrap_or_default(),
        media_id: f.media_id,
        media_type: f.media_type,
        title: f.title,
        poster_url: f.poster_url,
        rating: f.rating,
        year: f.year,
        created_at: chrono::DateTime::from_timestamp_millis(f.created_at.timestamp_millis())
            .unwrap_or_default()
            .to_rfc3339(),
    }
}

pub async fn handle_list(headers: &HeaderMap) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let col = collection(db);
    let mut cursor = match col.find(doc! { "user_id": auth_user.user_id }).await {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let mut favorites: Vec<FavoriteDto> = Vec::new();
    while let Ok(Some(fav)) = cursor.try_next().await {
        favorites.push(to_dto(fav));
    }
    with_cors(success(favorites))
}

pub async fn handle_check(headers: &HeaderMap, kp_id_str: &str, media_type: &str) -> VResp {
    if media_type != "movie" && media_type != "tv" {
        return with_cors(bad_request("type must be 'movie' or 'tv'"));
    }
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let media_id = format!("kp_{}", kp_id_str);
    let col = collection(db);
    let exists = col.find_one(doc! { "user_id": auth_user.user_id, "media_id": &media_id, "media_type": media_type })
        .await.map(|r| r.is_some()).unwrap_or(false);
    with_cors(success(json!({ "isFavorite": exists })))
}

pub async fn handle_add(headers: &HeaderMap, kp_id_str: &str, media_type: &str) -> VResp {
    if media_type != "movie" && media_type != "tv" {
        return with_cors(bad_request("type must be 'movie' or 'tv'"));
    }
    let kp_id: u64 = match kp_id_str.parse() {
        Ok(n) => n,
        Err(_) => return with_cors(bad_request("invalid kp_id")),
    };
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let kp = KinopoiskClient::new(&config.kpapi_key, &config.kpapi_base_url);
    let film = match kp.get_film(kp_id).await {
        Ok(f) => f,
        Err(e) if e == "not_found" => return with_cors(not_found("media not found")),
        Err(_) => return with_cors(internal_error()),
    };
    let media_id = format!("kp_{}", kp_id);
    let now_ms = chrono::Utc::now().timestamp_millis();
    let year: Option<i32> = film.release_date.split('-').next()
        .and_then(|y| y.parse().ok()).filter(|&y: &i32| y > 0);
    let _ = ensure_indexes(db).await;
    let col = collection(db);
    let result = col.update_one(
        doc! { "user_id": auth_user.user_id, "media_id": &media_id, "media_type": media_type },
        doc! { "$setOnInsert": {
            "user_id": auth_user.user_id,
            "media_id": &media_id,
            "media_type": media_type,
            "title": &film.title,
            "poster_url": &film.poster_url,
            "rating": film.rating,
            "year": year,
            "created_at": DateTime::from_millis(now_ms),
        }},
    ).with_options(UpdateOptions::builder().upsert(true).build()).await;
    match result {
        Ok(_) => with_cors(success(json!({ "mediaId": media_id }))),
        Err(_) => with_cors(internal_error()),
    }
}

pub async fn handle_remove(headers: &HeaderMap, kp_id_str: &str, media_type: &str) -> VResp {
    if media_type != "movie" && media_type != "tv" {
        return with_cors(bad_request("type must be 'movie' or 'tv'"));
    }
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let media_id = format!("kp_{}", kp_id_str);
    let col = collection(db);
    match col.delete_one(doc! { "user_id": auth_user.user_id, "media_id": &media_id, "media_type": media_type }).await {
        Ok(_) => with_cors(success(json!({ "mediaId": media_id }))),
        Err(_) => with_cors(internal_error()),
    }
}
