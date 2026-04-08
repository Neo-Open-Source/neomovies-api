use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub mongo_uri: String,
    pub mongo_db_name: String,
    pub jwt_secret: String,
    pub kpapi_key: String,
    pub kpapi_base_url: String,
    pub neo_id_url: String,
    pub neo_id_api_key: String,
    pub neo_id_site_id: String,
    pub hdvb_token: Option<String>,
    pub vibix_host: Option<String>,
    pub vibix_token: Option<String>,
    pub lumex_url: Option<String>,
    pub alloha_token: Option<String>,
    pub redapi_base_url: Option<String>,
    pub collaps_api_host: Option<String>,
    pub collaps_token: Option<String>,
}

#[derive(Debug)]
pub struct ConfigError(pub String);

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Config error: {}", self.0)
    }
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let mongo_uri = env::var("MONGO_URI")
            .map_err(|_| ConfigError("MONGO_URI is required".into()))?;
        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| ConfigError("JWT_SECRET is required".into()))?;

        Ok(Config {
            mongo_uri,
            jwt_secret,
            mongo_db_name: env::var("MONGO_DB_NAME").unwrap_or_else(|_| "neomovies".into()),
            kpapi_key: env::var("KPAPI_KEY").unwrap_or_default(),
            kpapi_base_url: env::var("KPAPI_BASE_URL")
                .unwrap_or_else(|_| "https://kinopoiskapiunofficial.tech/api".into()),
            neo_id_url: env::var("NEO_ID_URL").unwrap_or_default(),
            neo_id_api_key: env::var("NEO_ID_API_KEY").unwrap_or_default(),
            neo_id_site_id: env::var("NEO_ID_SITE_ID").unwrap_or_default(),
            hdvb_token: env::var("HDVB_TOKEN").ok(),
            vibix_host: env::var("VIBIX_HOST").ok(),
            vibix_token: env::var("VIBIX_TOKEN").ok(),
            lumex_url: env::var("LUMEX_URL").ok(),
            alloha_token: env::var("ALLOHA_TOKEN").ok(),
            redapi_base_url: env::var("REDAPI_BASE_URL").ok(),
            collaps_api_host: env::var("COLLAPS_API_HOST").ok(),
            collaps_token: env::var("COLLAPS_TOKEN").ok(),
        })
    }
}
