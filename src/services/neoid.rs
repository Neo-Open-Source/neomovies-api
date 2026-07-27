use serde::Deserialize;
use serde_json;

pub struct NeoIdClient {
    pub base_url: String,
    pub client_id: String,
    pub client_secret: String,
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
pub struct NeoIdUser {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub role: String,
}

impl NeoIdUser {
    pub fn display_name_resolved(&self) -> String {
        if let Some(name) = &self.display_name {
            if !name.trim().is_empty() {
                return name.clone();
            }
        }
        if let Some(name) = &self.username {
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

#[derive(Deserialize)]
#[allow(dead_code)]
struct OAuthTokenData {
    access_token: Option<String>,
    refresh_token: Option<String>,
    id_token: Option<String>,
    token_type: Option<String>,
    expires_in: Option<u64>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct OAuthTokenResponse {
    ok: bool,
    data: OAuthTokenData,
}

impl NeoIdClient {
    pub fn new(base_url: &str, client_id: &str, client_secret: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client_id: client_id.to_string(),
            client_secret: client_secret.to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    /// Build the OAuth2 authorize URL for the consent screen.
    pub fn build_authorize_url(
        &self,
        redirect_uri: &str,
        state: &str,
        code_challenge: Option<&str>,
        code_challenge_method: Option<&str>,
    ) -> String {
        let mut url = format!(
            "{}/api/v1/oauth/authorize?response_type=code&client_id={}&redirect_uri={}&state={}",
            self.base_url,
            urlencoding::encode(&self.client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(state),
        );
        if let Some(cc) = code_challenge {
            url.push_str(&format!("&code_challenge={}", urlencoding::encode(cc)));
        }
        if let Some(ccm) = code_challenge_method {
            url.push_str(&format!("&code_challenge_method={}", ccm));
        }
        url
    }

    /// Exchange authorization code for tokens.
    /// Uses the OAuth2 Token endpoint with `grant_type=authorization_code`.
    pub async fn exchange_auth_code(
        &self,
        code: &str,
        redirect_uri: &str,
        _code_verifier: Option<&str>,
    ) -> Result<OAuthTokenResult, String> {
        let url = format!("{}/api/v1/oauth/token", self.base_url);

        let body = serde_json::json!({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        });

        eprintln!("[neoid] POST {} body: {}", url, serde_json::to_string_pretty(&body).unwrap_or_default());

        let resp = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("neo id oauth token request failed: {}", e))?;

        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            eprintln!("[neoid] token exchange failed ({}): {}", status, body_text);
            return Err(format!("neo id oauth token error {}: {}", status, body_text));
        }
        eprintln!("[neoid] token exchange success");

        let wrapper: OAuthTokenResponse = serde_json::from_str(&body_text)
            .map_err(|e| format!("failed to parse neo id oauth token response: {}", e))?;

        let access_token = wrapper.data.access_token.unwrap_or_default();
        if access_token.is_empty() {
            return Err("neo id oauth token response missing access_token".to_string());
        }

        Ok(OAuthTokenResult {
            access_token,
            refresh_token: wrapper.data.refresh_token,
            id_token: wrapper.data.id_token,
            expires_in: wrapper.data.expires_in,
        })
    }

    /// Fetch user profile from NeoID using the access token.
    pub async fn get_profile(&self, access_token: &str) -> Result<NeoIdUser, String> {
        let url = format!("{}/api/v1/user/profile", self.base_url);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| format!("neo id profile request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err("neo id profile request failed".to_string());
        }

        #[derive(Deserialize)]
        struct ProfileResponse {
            data: NeoIdUser,
        }

        let profile: ProfileResponse = resp
            .json()
            .await
            .map_err(|e| format!("failed to parse neo id profile response: {}", e))?;

        Ok(profile.data)
    }

    /// Notify NeoID that a user deleted their account.
    pub async fn notify_user_deleted(&self, user_id: &str) {
        if self.base_url.is_empty() || self.client_secret.is_empty() {
            return;
        }
        let url = format!("{}/api/v1/webhooks/user-deleted", self.base_url);
        let body = serde_json::json!({
            "event": "user.deleted",
            "user_id": user_id,
            "client_id": self.client_id,
        });
        let _ = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await;
    }
}

pub struct OAuthTokenResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    pub expires_in: Option<u64>,
}
