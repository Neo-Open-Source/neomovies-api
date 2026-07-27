use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::Utc;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

/// JWKS TTL: обновлять кеш не чаще чем раз в 5 минут.
const JWKS_CACHE_TTL: Duration = Duration::from_secs(300);

struct JwksCache {
    modulus: String,
    exponent: String,
    fetched_at: Instant,
}

static JWKS: std::sync::OnceLock<Arc<RwLock<Option<JwksCache>>>> = std::sync::OnceLock::new();

fn jwks_lock() -> &'static Arc<RwLock<Option<JwksCache>>> {
    JWKS.get_or_init(|| Arc::new(RwLock::new(None)))
}

/// Our own session JWT claims (HS256, issued by neowatch-api).
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Claims {
    pub sub: String,
    pub neo_id: String,
    pub email: String,
    pub role: String,
    pub exp: usize,
    pub iat: usize,
}

/// NeoID access token claims (RS256, issued by id.neome.uk).
/// Used for local verification of NeoID tokens.
#[derive(Debug, Deserialize)]
pub struct NeoIdClaims {
    pub sub: String,
    pub email: String,
    pub role: Option<String>,
    pub session_id: Option<String>,
    pub iss: Option<String>,
    pub exp: usize,
    pub iat: usize,
    pub jti: Option<String>,
}

#[derive(Debug)]
pub struct JwtError(pub String);

impl std::fmt::Display for JwtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<jsonwebtoken::errors::Error> for JwtError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        JwtError(e.to_string())
    }
}

/// Encode our own access token (HS256).
pub fn encode_access_token(claims: &Claims, secret: &str) -> Result<String, JwtError> {
    let key = EncodingKey::from_secret(secret.as_bytes());
    encode(&Header::default(), claims, &key).map_err(JwtError::from)
}

pub fn encode_refresh_token() -> String {
    let bytes: Vec<u8> = (0..64).map(|_| rand::random::<u8>()).collect();
    hex::encode(bytes)
}

/// Decode our own access token (HS256).
pub fn decode_token(token: &str, secret: &str) -> Result<Claims, JwtError> {
    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::default();
    validation.algorithms = vec![Algorithm::HS256];
    let data = decode::<Claims>(token, &key, &validation)?;
    Ok(data.claims)
}

async fn get_jwks(neo_id_url: &str) -> Result<(String, String), JwtError> {
    // Быстрая проверка под read-lock: кеш свежий?
    {
        let guard = jwks_lock().read().await;
        if let Some(ref cache) = *guard {
            if cache.fetched_at.elapsed() < JWKS_CACHE_TTL {
                return Ok((cache.modulus.clone(), cache.exponent.clone()));
            }
        }
    }

    // Обновляем под write-lock (double-checked locking).
    let mut guard = jwks_lock().write().await;
    if let Some(ref cache) = *guard {
        if cache.fetched_at.elapsed() < JWKS_CACHE_TTL {
            return Ok((cache.modulus.clone(), cache.exponent.clone()));
        }
    }

    let jwks_url = format!("{}/.well-known/jwks.json", neo_id_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| JwtError(format!("http client build failed: {}", e)))?;
    let resp = client
        .get(&jwks_url)
        .send()
        .await
        .map_err(|e| JwtError(format!("jwks fetch failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(JwtError(format!("jwks fetch returned status {}", resp.status())));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| JwtError(format!("jwks parse failed: {}", e)))?;
    let keys = body["keys"]
        .as_array()
        .ok_or_else(|| JwtError("jwks missing keys array".to_string()))?;
    let first = keys
        .first()
        .ok_or_else(|| JwtError("jwks keys array empty".to_string()))?;
    let n = first["n"]
        .as_str()
        .ok_or_else(|| JwtError("jwks key missing n".to_string()))?
        .to_string();
    let e = first["e"]
        .as_str()
        .ok_or_else(|| JwtError("jwks key missing e".to_string()))?
        .to_string();

    *guard = Some(JwksCache { modulus: n.clone(), exponent: e.clone(), fetched_at: Instant::now() });
    Ok((n, e))
}

/// Verify a NeoID access token (RS256). Fetches and caches JWKS from NeoID (TTL 5min).
pub async fn verify_neo_id_token(token: &str, neo_id_url: &str) -> Result<NeoIdClaims, JwtError> {
    let (modulus, exponent) = get_jwks(neo_id_url).await?;
    let key = DecodingKey::from_rsa_components(&modulus, &exponent)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;
    let mut valid_iss = HashSet::new();
    valid_iss.insert("https://id.neome.uk".to_string());
    validation.iss = Some(valid_iss);
    let data = decode::<NeoIdClaims>(token, &key, &validation)?;
    Ok(data.claims)
}

pub fn build_claims(sub: String, neo_id: String, email: String, role: String) -> Claims {
    let iat = Utc::now().timestamp() as usize;
    Claims { sub, neo_id, email, role, iat, exp: iat + 3600 }
}
