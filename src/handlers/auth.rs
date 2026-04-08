use mongodb::bson::{self, DateTime, doc};
use chrono::Utc;
use http::HeaderMap;
use serde::{Deserialize, Serialize};
use serde_json::json;
use vercel_runtime::{Response, ResponseBody};

use crate::{
    Config, internal_error, not_found, success, unauthorized, with_cors, bad_request, bad_gateway,
    auth::{build_claims, encode_access_token, encode_refresh_token, middleware::require_auth_headers},
    models::user::{RefreshToken, User, collection},
    services::NeoIdClient,
};

type VResp = Response<ResponseBody>;

#[derive(Serialize)]
pub struct ProfileDto {
    pub id: String,
    pub neo_id: String,
    pub email: String,
    pub name: String,
    pub avatar: String,
    pub is_admin: bool,
    pub created_at: String,
    pub updated_at: String,
}

fn bson_dt_to_iso(dt: DateTime) -> String {
    chrono::DateTime::from_timestamp_millis(dt.timestamp_millis())
        .unwrap_or_default()
        .to_rfc3339()
}

// ── Login ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginBody {
    pub redirect_url: String,
    pub state: String,
    pub mode: Option<String>,
}

pub async fn handle_login(body_bytes: &[u8]) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let body: LoginBody = match serde_json::from_slice(body_bytes) {
        Ok(b) => b,
        Err(_) => return with_cors(bad_request("invalid payload")),
    };
    if body.redirect_url.is_empty() { return with_cors(bad_request("redirect_url is required")); }
    if body.state.is_empty() { return with_cors(bad_request("state is required")); }
    let neo_id = NeoIdClient::new(&config.neo_id_url, &config.neo_id_api_key, &config.neo_id_site_id);
    match neo_id.request_login_url(&body.redirect_url, &body.state, body.mode.as_deref()).await {
        Ok(login_url) => {
            let resp = Response::builder()
                .status(200)
                .header("Content-Type", "application/json")
                .body(ResponseBody::from(json!({ "login_url": login_url }).to_string()))
                .unwrap();
            with_cors(resp)
        }
        Err(_) => with_cors(bad_gateway("neo id service unavailable")),
    }
}

// ── Callback ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CallbackBody {
    pub access_token: Option<String>,
    pub token: Option<String>,
}

pub async fn handle_callback(body_bytes: &[u8]) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let body: CallbackBody = match serde_json::from_slice(body_bytes) {
        Ok(b) => b,
        Err(_) => return with_cors(unauthorized("invalid neo id token")),
    };
    let incoming_token = body
        .access_token
        .or(body.token)
        .unwrap_or_default()
        .trim()
        .to_string();
    if incoming_token.is_empty() {
        return with_cors(unauthorized("invalid neo id token"));
    }
    let neo_id_client = NeoIdClient::new(&config.neo_id_url, &config.neo_id_api_key, &config.neo_id_site_id);
    let neo_user = match neo_id_client.verify_token(&incoming_token).await {
        Ok(u) => u,
        Err(_) => return with_cors(unauthorized("invalid neo id token")),
    };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let col = collection(db);
    let now_ms = Utc::now().timestamp_millis();
    let now_bson = DateTime::from_millis(now_ms);
    let resolved_name = neo_user.display_name_resolved();
    let resolved_avatar = neo_user.avatar.clone().unwrap_or_default();

    let user = match col.find_one(doc! { "neo_id": &neo_user.unified_id }).await {
        Ok(Some(mut existing)) => {
            if existing.name != resolved_name || existing.avatar != resolved_avatar {
                existing.name = resolved_name.clone();
                existing.avatar = resolved_avatar.clone();
                existing.updated_at = now_bson;
                let _ = col.update_one(
                    doc! { "neo_id": &neo_user.unified_id },
                    doc! { "$set": { "name": &resolved_name, "avatar": &resolved_avatar, "updated_at": now_bson } },
                ).await;
            }
            existing
        }
        Ok(None) => {
            let new_user = User {
                id: None,
                neo_id: neo_user.unified_id.clone(),
                email: neo_user.email.clone(),
                name: resolved_name.clone(),
                avatar: resolved_avatar.clone(),
                is_admin: false,
                created_at: now_bson,
                updated_at: now_bson,
                refresh_tokens: vec![],
            };
            match col.insert_one(&new_user).await {
                Ok(result) => { let mut u = new_user; u.id = result.inserted_id.as_object_id(); u }
                Err(_) => return with_cors(internal_error()),
            }
        }
        Err(_) => return with_cors(internal_error()),
    };

    let user_id = match user.id { Some(oid) => oid.to_hex(), None => return with_cors(internal_error()) };
    let claims = build_claims(user_id, user.neo_id.clone(), user.email.clone(), user.is_admin);
    let access_token = match encode_access_token(&claims, &config.jwt_secret) {
        Ok(t) => t,
        Err(_) => return with_cors(internal_error()),
    };
    let refresh_token_str = encode_refresh_token();
    let expires_at = DateTime::from_millis(now_ms + 30 * 24 * 60 * 60 * 1000_i64);
    let rt = RefreshToken { token: refresh_token_str.clone(), expires_at, created_at: now_bson, user_agent: None, ip_address: None };
    let rt_bson = bson::serialize_to_bson(&rt).unwrap_or(bson::Bson::Null);
    let _ = col.update_one(doc! { "neo_id": &user.neo_id }, doc! { "$push": { "refresh_tokens": rt_bson } }).await;

    let resp = Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(json!({
            "accessToken": access_token,
            "refreshToken": refresh_token_str,
            "user": {
                "id": user.id.map(|id| id.to_hex()).unwrap_or_default(),
                "neo_id": user.neo_id,
                "email": user.email,
                "name": user.name,
                "avatar": user.avatar,
                "is_admin": user.is_admin
            }
        }).to_string()))
        .unwrap();
    with_cors(resp)
}

// ── Refresh ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshBody {
    pub refresh_token: String,
}

pub async fn handle_refresh(body_bytes: &[u8]) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let body: RefreshBody = match serde_json::from_slice(body_bytes) {
        Ok(b) => b,
        Err(_) => return with_cors(unauthorized("invalid or expired refresh token")),
    };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let col = collection(db);
    let user = match col.find_one(doc! { "refresh_tokens.token": &body.refresh_token }).await {
        Ok(Some(u)) => u,
        _ => return with_cors(unauthorized("invalid or expired refresh token")),
    };
    let now_ms = Utc::now().timestamp_millis();
    let token_entry = match user.refresh_tokens.iter().find(|t| t.token == body.refresh_token) {
        Some(t) => t,
        None => return with_cors(unauthorized("invalid or expired refresh token")),
    };
    if token_entry.expires_at.timestamp_millis() <= now_ms {
        return with_cors(unauthorized("invalid or expired refresh token"));
    }
    let _ = col.update_one(doc! { "_id": user.id }, doc! { "$pull": { "refresh_tokens": { "token": &body.refresh_token } } }).await;
    let user_id = user.id.map(|id| id.to_hex()).unwrap_or_default();
    let claims = build_claims(user_id, user.neo_id, user.email, user.is_admin);
    let access_token = match encode_access_token(&claims, &config.jwt_secret) {
        Ok(t) => t,
        Err(_) => return with_cors(internal_error()),
    };
    let new_refresh = encode_refresh_token();
    let expires_at = DateTime::from_millis(now_ms + 30 * 24 * 60 * 60 * 1000);
    let new_rt = RefreshToken { token: new_refresh.clone(), expires_at, created_at: DateTime::from_millis(now_ms), user_agent: None, ip_address: None };
    let new_rt_bson = bson::serialize_to_bson(&new_rt).unwrap_or(bson::Bson::Null);
    let _ = col.update_one(doc! { "_id": user.id }, doc! { "$push": { "refresh_tokens": new_rt_bson } }).await;
    let resp = Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(json!({ "accessToken": access_token, "refreshToken": new_refresh }).to_string()))
        .unwrap();
    with_cors(resp)
}

// ── Profile ───────────────────────────────────────────────────────────────────

#[derive(Deserialize, Default)]
pub struct UpdateProfileBody {
    pub name: Option<String>,
    pub avatar: Option<String>,
}

pub async fn handle_profile_get(headers: &HeaderMap) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let col = collection(db);
    let user = match col.find_one(doc! { "_id": auth_user.user_id }).await {
        Ok(Some(u)) => u,
        Ok(None) => return with_cors(not_found("user not found")),
        Err(_) => return with_cors(internal_error()),
    };
    with_cors(success(ProfileDto {
        id: user.id.map(|id| id.to_hex()).unwrap_or_default(),
        neo_id: user.neo_id, email: user.email, name: user.name, avatar: user.avatar,
        is_admin: user.is_admin,
        created_at: bson_dt_to_iso(user.created_at),
        updated_at: bson_dt_to_iso(user.updated_at),
    }))
}

pub async fn handle_profile_put(headers: &HeaderMap, body_bytes: &[u8]) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let body: UpdateProfileBody = serde_json::from_slice(body_bytes).unwrap_or_default();
    let now_ms = Utc::now().timestamp_millis();
    let mut set_doc = doc! { "updated_at": DateTime::from_millis(now_ms) };
    if let Some(name) = body.name { set_doc.insert("name", name); }
    if let Some(avatar) = body.avatar { set_doc.insert("avatar", avatar); }
    let col = collection(db);
    if col.update_one(doc! { "_id": auth_user.user_id }, doc! { "$set": set_doc }).await.is_err() {
        return with_cors(internal_error());
    }
    let updated = match col.find_one(doc! { "_id": auth_user.user_id }).await {
        Ok(Some(u)) => u,
        Ok(None) => return with_cors(not_found("user not found")),
        Err(_) => return with_cors(internal_error()),
    };
    with_cors(success(ProfileDto {
        id: updated.id.map(|id| id.to_hex()).unwrap_or_default(),
        neo_id: updated.neo_id, email: updated.email, name: updated.name, avatar: updated.avatar,
        is_admin: updated.is_admin,
        created_at: bson_dt_to_iso(updated.created_at),
        updated_at: bson_dt_to_iso(updated.updated_at),
    }))
}

// ── Revoke ────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeBody {
    pub refresh_token: String,
}

pub async fn handle_revoke(headers: &HeaderMap, body_bytes: &[u8]) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let body: RevokeBody = match serde_json::from_slice(body_bytes) {
        Ok(b) => b,
        Err(_) => return with_cors(bad_request("invalid payload")),
    };
    if body.refresh_token.is_empty() { return with_cors(bad_request("refreshToken is required")); }
    let col = collection(db);
    if col.update_one(doc! { "_id": auth_user.user_id }, doc! { "$pull": { "refresh_tokens": { "token": &body.refresh_token } } }).await.is_err() {
        return with_cors(internal_error());
    }
    with_cors(success(json!({})))
}

pub async fn handle_revoke_all(headers: &HeaderMap) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    let col = collection(db);
    if col.update_one(doc! { "_id": auth_user.user_id }, doc! { "$set": { "refresh_tokens": [] } }).await.is_err() {
        return with_cors(internal_error());
    }
    with_cors(success(json!({})))
}

// ── Delete account ────────────────────────────────────────────────────────────

pub async fn handle_delete(headers: &HeaderMap) -> VResp {
    let config = match Config::from_env() { Ok(c) => c, Err(_) => return with_cors(internal_error()) };
    let db = match crate::db::get_db().await { Ok(d) => d, Err(_) => return with_cors(internal_error()) };
    let auth_user = match require_auth_headers(headers, db, &config).await { Ok(u) => u, Err(r) => return with_cors(r) };
    use mongodb::bson::Document;
    let _ = db.collection::<Document>("favorites").delete_many(doc! { "user_id": auth_user.user_id }).await;
    if collection(db).delete_one(doc! { "_id": auth_user.user_id }).await.is_err() {
        return with_cors(internal_error());
    }
    let neo_id = auth_user.neo_id.clone();
    let neo_id_client = NeoIdClient::new(&config.neo_id_url, &config.neo_id_api_key, &config.neo_id_site_id);
    tokio::spawn(async move { neo_id_client.notify_user_deleted(&neo_id).await; });
    with_cors(success(json!({})))
}
