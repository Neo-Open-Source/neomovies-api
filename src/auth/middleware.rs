use http::HeaderMap;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::Database;
use vercel_runtime::{Request, Response, ResponseBody};

use crate::{config::Config, unauthorized};
use super::jwt::decode_token;

pub struct AuthUser {
    pub user_id: ObjectId,
    pub neo_id: String,
    pub email: String,
    pub is_admin: bool,
}

pub async fn require_auth(
    req: &Request,
    db: &Database,
    config: &Config,
) -> Result<AuthUser, Response<ResponseBody>> {
    require_auth_headers(req.headers(), db, config).await
}

pub async fn require_auth_headers(
    headers: &HeaderMap,
    db: &Database,
    config: &Config,
) -> Result<AuthUser, Response<ResponseBody>> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !auth_header.starts_with("Bearer ") {
        return Err(unauthorized("unauthorized"));
    }

    let token = &auth_header["Bearer ".len()..];
    if token.is_empty() {
        return Err(unauthorized("unauthorized"));
    }

    let claims = decode_token(token, &config.jwt_secret)
        .map_err(|_| unauthorized("unauthorized"))?;

    let user_id = ObjectId::parse_str(&claims.sub)
        .map_err(|_| unauthorized("unauthorized"))?;

    let col = db.collection::<Document>("users");
    let user_doc = col
        .find_one(doc! { "_id": user_id })
        .await
        .map_err(|_| unauthorized("unauthorized"))?;

    if user_doc.is_none() {
        return Err(unauthorized("user not found"));
    }

    Ok(AuthUser {
        user_id,
        neo_id: claims.neo_id,
        email: claims.email,
        is_admin: claims.is_admin,
    })
}

pub fn user_not_found_response() -> Response<ResponseBody> {
    unauthorized("user not found")
}
