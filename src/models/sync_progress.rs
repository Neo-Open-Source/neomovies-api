use mongodb::bson::{doc, oid::ObjectId, DateTime};
use mongodb::{Collection, Database, IndexModel, options::IndexOptions};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncProgress {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub media_id: String,
    pub media_type: String,
    pub season: Option<i32>,
    pub episode: Option<i32>,
    pub progress: f64,
    pub duration: f64,
    pub status: String,
    pub updated_at: DateTime,
    pub created_at: DateTime,
}

pub fn collection(db: &Database) -> Collection<SyncProgress> {
    db.collection("sync_progress")
}

pub async fn ensure_indexes(db: &Database) -> Result<(), mongodb::error::Error> {
    let col = collection(db);

    col.create_index(
        IndexModel::builder()
            .keys(doc! { "user_id": 1, "media_id": 1, "season": 1, "episode": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build(),
    )
    .await?;

    col.create_index(
        IndexModel::builder()
            .keys(doc! { "user_id": 1, "updated_at": -1 })
            .build(),
    )
    .await?;

    Ok(())
}
