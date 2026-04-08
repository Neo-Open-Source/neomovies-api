use mongodb::bson::{doc, Document};
use crate::{bad_request, internal_error, success, with_cors};
use serde::Deserialize;
use vercel_runtime::{Response, ResponseBody};

#[derive(Deserialize)]
pub struct WebhookPayload {
    pub event: String,
    pub unified_id: String,
}

pub async fn handle_neoid(body_str: &str) -> Response<ResponseBody> {
    let payload: WebhookPayload = match serde_json::from_str(body_str) {
        Ok(p) => p,
        Err(_) => return with_cors(bad_request("invalid payload")),
    };

    if payload.event != "user.deleted" {
        return with_cors(success(serde_json::json!({})));
    }

    let db = match crate::db::get_db().await {
        Ok(d) => d,
        Err(_) => return with_cors(internal_error()),
    };

    let users_col = crate::models::user::collection(db);
    let user = users_col
        .find_one(doc! { "neo_id": &payload.unified_id })
        .await
        .unwrap_or(None);

    if let Some(user) = user {
        if let Some(user_id) = user.id {
            let _ = db.collection::<Document>("favorites")
                .delete_many(doc! { "user_id": user_id }).await;
        }
        let _ = users_col.delete_one(doc! { "neo_id": &payload.unified_id }).await;
    }

    with_cors(success(serde_json::json!({})))
}
