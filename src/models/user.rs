use mongodb::bson::{doc, oid::ObjectId, DateTime};
use mongodb::{Collection, Database, IndexModel, options::IndexOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub neo_id: String,
    pub email: String,
    pub name: String,
    pub avatar: String,
    pub is_admin: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
    pub refresh_tokens: Vec<RefreshToken>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshToken {
    pub token: String,
    pub expires_at: DateTime,
    pub created_at: DateTime,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
}

pub fn collection(db: &Database) -> Collection<User> {
    db.collection("users")
}

pub async fn ensure_indexes(db: &Database) -> Result<(), mongodb::error::Error> {
    let col = collection(db);

    // Unique index on neo_id
    col.create_index(
        IndexModel::builder()
            .keys(doc! { "neo_id": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build(),
    )
    .await?;

    // Index on email
    col.create_index(
        IndexModel::builder()
            .keys(doc! { "email": 1 })
            .build(),
    )
    .await?;

    // Index on refresh_tokens.token
    col.create_index(
        IndexModel::builder()
            .keys(doc! { "refresh_tokens.token": 1 })
            .build(),
    )
    .await?;

    // TTL index on refresh_tokens.expires_at (expire at the stored time)
    col.create_index(
        IndexModel::builder()
            .keys(doc! { "refresh_tokens.expires_at": 1 })
            .options(
                IndexOptions::builder()
                    .expire_after(Duration::from_secs(0))
                    .build(),
            )
            .build(),
    )
    .await?;

    Ok(())
}
