use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Claims {
    pub sub: String,
    pub neo_id: String,
    pub email: String,
    pub is_admin: bool,
    pub exp: usize,
    pub iat: usize,
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

pub fn encode_access_token(claims: &Claims, secret: &str) -> Result<String, JwtError> {
    let key = EncodingKey::from_secret(secret.as_bytes());
    encode(&Header::default(), claims, &key).map_err(JwtError::from)
}

pub fn encode_refresh_token() -> String {
    let bytes: Vec<u8> = (0..64).map(|_| rand::random::<u8>()).collect();
    hex::encode(bytes)
}

pub fn decode_token(token: &str, secret: &str) -> Result<Claims, JwtError> {
    let key = DecodingKey::from_secret(secret.as_bytes());
    let data = decode::<Claims>(token, &key, &Validation::default())?;
    Ok(data.claims)
}

pub fn build_claims(sub: String, neo_id: String, email: String, is_admin: bool) -> Claims {
    let iat = Utc::now().timestamp() as usize;
    Claims { sub, neo_id, email, is_admin, iat, exp: iat + 900 }
}
