use mongodb::bson::{doc, oid::ObjectId, DateTime};
use mongodb::{Collection, Database, IndexModel, options::IndexOptions};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Favorite {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub media_id: String,
    pub media_type: String,
    pub title: String,
    pub poster_url: String,
    pub rating: Option<f64>,
    pub year: Option<i32>,
    pub created_at: DateTime,
}

pub fn collection(db: &Database) -> Collection<Favorite> {
    db.collection("favorites")
}

pub async fn ensure_indexes(db: &Database) -> Result<(), mongodb::error::Error> {
    let col = collection(db);

    // Unique compound index on { user_id, media_id, media_type }
    col.create_index(
        IndexModel::builder()
            .keys(doc! { "user_id": 1, "media_id": 1, "media_type": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build(),
    )
    .await?;

    Ok(())
}
