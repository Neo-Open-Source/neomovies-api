use mongodb::bson::{DateTime, doc};
use futures_util::TryStreamExt;
use http::HeaderMap;
use mongodb::options::UpdateOptions;
use serde::{Deserialize, Serialize};
use serde_json::json;
use vercel_runtime::{Response, ResponseBody};

use crate::{
    Config, bad_request, internal_error, success, with_cors,
    auth::middleware::require_auth_headers,
    models::sync_progress::{collection, ensure_indexes, SyncProgress},
};

type VResp = Response<ResponseBody>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProgressBody {
    pub media_id: String,
    pub media_type: String,
    pub season: Option<i32>,
    pub episode: Option<i32>,
    pub progress: f64,
    pub duration: f64,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSyncBody {
    pub items: Vec<UpsertProgressBody>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProgressDto {
    pub media_id: String,
    pub media_type: String,
    pub season: Option<i32>,
    pub episode: Option<i32>,
    pub progress: f64,
    pub duration: f64,
    pub status: String,
    pub updated_at: String,
    pub created_at: String,
}

fn to_dto(s: SyncProgress) -> SyncProgressDto {
    SyncProgressDto {
        media_id: s.media_id,
        media_type: s.media_type,
        season: s.season,
        episode: s.episode,
        progress: s.progress,
        duration: s.duration,
        status: s.status,
        updated_at: chrono::DateTime::from_timestamp_millis(s.updated_at.timestamp_millis())
            .unwrap_or_default()
            .to_rfc3339(),
        created_at: chrono::DateTime::from_timestamp_millis(s.created_at.timestamp_millis())
            .unwrap_or_default()
            .to_rfc3339(),
    }
}

fn parse_iso_millis(iso: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|dt| dt.timestamp_millis())
}

pub async fn handle_upsert(headers: &HeaderMap, body: UpsertProgressBody) -> VResp {
    if body.media_type != "movie" && body.media_type != "tv" {
        return with_cors(bad_request("mediaType must be 'movie' or 'tv'"));
    }
    if body.status != "watching" && body.status != "completed" && body.status != "paused" && body.status != "dropped" {
        return with_cors(bad_request("status must be 'watching', 'completed', 'paused', or 'dropped'"));
    }

    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };

    let client_ts = parse_iso_millis(&body.updated_at).unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
    let now_ms = chrono::Utc::now().timestamp_millis();

    let _ = ensure_indexes(db).await;
    let col = collection(db);

    let filter = doc! {
        "user_id": auth_user.user_id,
        "media_id": &body.media_id,
        "season": body.season,
        "episode": body.episode,
    };

    // First, check if existing entry with newer updated_at
    let existing = col.find_one(filter.clone()).await.unwrap_or(None);
    if let Some(ex) = &existing {
        let server_ts = ex.updated_at.timestamp_millis();
        if server_ts > client_ts {
            // Server has newer data — return existing
            return with_cors(success(json!({
                "saved": false,
                "item": to_dto(ex.clone()),
            })));
        }
    }

    let doc_updated_at = DateTime::from_millis(client_ts.max(now_ms));
    let doc_created_at = existing.as_ref()
        .map(|e| e.created_at)
        .unwrap_or(DateTime::from_millis(now_ms));

    let result = col.update_one(
        filter.clone(),
        doc! { "$set": {
            "user_id": auth_user.user_id,
            "media_id": &body.media_id,
            "media_type": &body.media_type,
            "season": body.season,
            "episode": body.episode,
            "progress": body.progress,
            "duration": body.duration,
            "status": &body.status,
            "updated_at": doc_updated_at,
            "created_at": doc_created_at,
        }},
    ).with_options(UpdateOptions::builder().upsert(true).build()).await;

    match result {
        Ok(_) => {
            let saved = col.find_one(filter).await.unwrap_or(None);
            with_cors(success(json!({
                "saved": true,
                "item": saved.map(to_dto),
            })))
        }
        Err(_) => with_cors(internal_error()),
    }
}

pub async fn handle_batch(headers: &HeaderMap, body: BatchSyncBody) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };

    let _ = ensure_indexes(db).await;
    let col = collection(db);
    let now_ms = chrono::Utc::now().timestamp_millis();
    let mut saved_count = 0u32;

    for item in &body.items {
        let client_ts = parse_iso_millis(&item.updated_at).unwrap_or(now_ms);

        let filter = doc! {
            "user_id": auth_user.user_id,
            "media_id": &item.media_id,
            "season": item.season,
            "episode": item.episode,
        };

        let existing = col.find_one(filter.clone()).await.unwrap_or(None);
        let should_update = match &existing {
            Some(ex) => client_ts >= ex.updated_at.timestamp_millis(),
            None => true,
        };

        if should_update {
            let doc_updated_at = DateTime::from_millis(client_ts.max(now_ms));
            let doc_created_at = existing.as_ref()
                .map(|e| e.created_at)
                .unwrap_or(DateTime::from_millis(now_ms));

            let _ = col.update_one(
                filter,
                doc! { "$set": {
                    "user_id": auth_user.user_id,
                    "media_id": &item.media_id,
                    "media_type": &item.media_type,
                    "season": item.season,
                    "episode": item.episode,
                    "progress": item.progress,
                    "duration": item.duration,
                    "status": &item.status,
                    "updated_at": doc_updated_at,
                    "created_at": doc_created_at,
                }},
            ).with_options(UpdateOptions::builder().upsert(true).build()).await.ok();
            saved_count += 1;
        }
    }

    // Return all progress for user after batch
    let mut cursor = match col.find(doc! { "user_id": auth_user.user_id }).await {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let mut items: Vec<SyncProgressDto> = Vec::new();
    while let Ok(Some(p)) = cursor.try_next().await {
        items.push(to_dto(p));
    }

    with_cors(success(json!({
        "saved": saved_count,
        "items": items,
    })))
}

pub async fn handle_get(headers: &HeaderMap, media_id: Option<&str>) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };

    let col = collection(db);

    let filter = match media_id {
        Some(mid) => doc! { "user_id": auth_user.user_id, "media_id": format!("kp_{}", mid.trim_start_matches("kp_")) },
        None => doc! { "user_id": auth_user.user_id },
    };

    let mut cursor = match col.find(filter).await {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };
    let mut items: Vec<SyncProgressDto> = Vec::new();
    while let Ok(Some(p)) = cursor.try_next().await {
        items.push(to_dto(p));
    }

    with_cors(success(items))
}

pub async fn handle_delete(headers: &HeaderMap, media_id: &str, season: Option<i32>, episode: Option<i32>) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };

    let mid = format!("kp_{}", media_id.trim_start_matches("kp_"));
    let col = collection(db);

    let result = col.delete_one(doc! {
        "user_id": auth_user.user_id,
        "media_id": &mid,
        "season": season,
        "episode": episode,
    }).await;

    match result {
        Ok(_) => with_cors(success(json!({ "deleted": true }))),
        Err(_) => with_cors(internal_error()),
    }
}
