use mongodb::{Client, Database, options::ClientOptions};
use tokio::sync::OnceCell;

static DB: OnceCell<Database> = OnceCell::const_new();

pub async fn get_db() -> Result<&'static Database, mongodb::error::Error> {
    DB.get_or_try_init(|| async {
        let uri = std::env::var("MONGO_URI")
            .map_err(|_| mongodb::error::Error::custom("MONGO_URI not set"))?;
        let db_name = std::env::var("MONGO_DB_NAME")
            .unwrap_or_else(|_| "neomovies".into());

        let options = ClientOptions::parse(&uri).await?;
        let client = Client::with_options(options)?;
        Ok(client.database(&db_name))
    })
    .await
}
