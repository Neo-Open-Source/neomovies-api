use serde::{Deserialize, Serialize};

pub struct NeoIdClient {
    pub base_url: String,
    pub api_key: String,
    pub site_id: String,
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
pub struct NeoIdUser {
    pub unified_id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

impl NeoIdUser {
    pub fn display_name_resolved(&self) -> String {
        if let Some(name) = &self.display_name {
            if !name.trim().is_empty() {
                return name.clone();
            }
        }
        let first = self.first_name.as_deref().unwrap_or("");
        let last = self.last_name.as_deref().unwrap_or("");
        let full = format!("{} {}", first, last).trim().to_string();
        if !full.is_empty() {
            return full;
        }
        self.email.split('@').next().unwrap_or("").to_string()
    }
}

#[derive(Serialize)]
struct LoginRequest<'a> {
    redirect_url: &'a str,
    state: &'a str,
    mode: &'a str,
}

#[derive(Deserialize)]
struct LoginResponse {
    login_url: Option<String>,
}

#[derive(Serialize)]
struct VerifyRequest<'a> {
    token: &'a str,
}

#[derive(Deserialize)]
struct VerifyResponse {
    valid: bool,
    user: Option<NeoIdUser>,
}

impl NeoIdClient {
    pub fn new(base_url: &str, api_key: &str, site_id: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            site_id: site_id.to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    /// Request a login URL from Neo ID. Returns the login_url string.
    /// Returns Err with message if Neo ID returns non-200.
    pub async fn request_login_url(
        &self,
        redirect_url: &str,
        state: &str,
        mode: Option<&str>,
    ) -> Result<String, String> {
        let url = format!("{}/api/service/login", self.base_url);
        let body = LoginRequest {
            redirect_url,
            state,
            mode: mode.unwrap_or("redirect"),
        };

        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("X-API-Key", &self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("neo id login request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err("neo id service unavailable".to_string());
        }

        let data: LoginResponse = resp
            .json()
            .await
            .map_err(|e| format!("failed to parse neo id login response: {}", e))?;

        let login_url = data.login_url.unwrap_or_default();
        if login_url.is_empty() {
            return Err("neo id returned empty login_url".to_string());
        }

        // Make absolute if relative
        if login_url.starts_with('/') {
            Ok(format!("{}{}", self.base_url, login_url))
        } else {
            Ok(login_url)
        }
    }

    /// Verify a Neo ID access token. Returns the NeoIdUser on success.
    /// Returns Err if token is invalid or Neo ID returns non-200.
    pub async fn verify_token(&self, access_token: &str) -> Result<NeoIdUser, String> {
        let url = format!("{}/api/service/verify", self.base_url);
        let body = VerifyRequest { token: access_token };

        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("X-API-Key", &self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("neo id verify request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err("invalid neo id token".to_string());
        }

        let data: VerifyResponse = resp
            .json()
            .await
            .map_err(|e| format!("failed to parse neo id verify response: {}", e))?;

        if !data.valid {
            return Err("invalid neo id token".to_string());
        }

        data.user.ok_or_else(|| "neo id returned no user".to_string())
    }

    /// Fire-and-forget notification to Neo ID that a user deleted their account.
    pub async fn notify_user_deleted(&self, unified_id: &str) {
        if self.api_key.is_empty() || self.base_url.is_empty() {
            return;
        }
        let url = format!("{}/api/service/user-deleted", self.base_url);
        let body = serde_json::json!({
            "event": "user.deleted",
            "unified_id": unified_id,
        });
        let _ = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await;
    }
}
