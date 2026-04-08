use serde::Deserialize;
use serde_json::Value;

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap()
}

fn alloha_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        // TEMP: Alloha endpoint currently has an expired certificate.
        // Restrict this bypass to Alloha-only client.
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap()
}

fn iframe_html(player_url: &str, title: &str) -> String {
    format!(
        r#"<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'/><title>{title}</title><style>html,body{{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}}iframe{{display:block;position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#000;}}</style></head><body><iframe src="{url}" allowfullscreen loading="eager" scrolling="no" referrerpolicy="no-referrer-when-downgrade" allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe></body></html>"#,
        title = title,
        url = player_url,
    )
}

// ── Alloha ────────────────────────────────────────────────────────────────────

fn non_empty_str(v: Option<&Value>) -> Option<String> {
    v.and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn first_translation_iframe(translation_obj: Option<&Value>) -> Option<String> {
    let obj = translation_obj?.as_object()?;
    obj.values()
        .find_map(|tr| non_empty_str(tr.get("iframe")))
}

fn first_episode_iframe(episode_obj: Option<&Value>) -> Option<String> {
    non_empty_str(episode_obj.and_then(|e| e.get("iframe")))
        .or_else(|| first_translation_iframe(episode_obj.and_then(|e| e.get("translation"))))
}

fn pick_alloha_iframe(data: &Value, season: Option<u32>, episode: Option<u32>) -> Option<String> {
    if let Some(v) = non_empty_str(data.get("iframe")) {
        return Some(v);
    }

    let seasons = data.get("seasons")?.as_object()?;
    if let Some(s) = season {
        let season_key = s.to_string();
        let season_obj = seasons.get(&season_key)?;
        if let Some(ep) = episode {
            let episode_key = ep.to_string();
            return first_episode_iframe(season_obj.get("episodes").and_then(|e| e.get(&episode_key)))
                .or_else(|| non_empty_str(season_obj.get("iframe")));
        }

        return non_empty_str(season_obj.get("iframe")).or_else(|| {
            season_obj
                .get("episodes")
                .and_then(Value::as_object)
                .and_then(|episodes| episodes.values().find_map(|ep| first_episode_iframe(Some(ep))))
        });
    }

    seasons.values().find_map(|season_obj| {
        non_empty_str(season_obj.get("iframe")).or_else(|| {
            season_obj
                .get("episodes")
                .and_then(Value::as_object)
                .and_then(|episodes| episodes.values().find_map(|ep| first_episode_iframe(Some(ep))))
        })
    })
}

/// Returns HTML iframe page for Alloha player by KP ID.
/// Returns Err("not_found") if video not found, Err("not_configured") if token missing.
pub async fn get_alloha_player(
    kp_id: u64,
    token: &str,
    season: Option<u32>,
    episode: Option<u32>,
) -> Result<String, String> {
    if token.is_empty() {
        return Err("not_configured".to_string());
    }

    let mut resp_opt = None;
    let mut last_err: Option<String> = None;
    let urls = [
        format!("https://api.alloha.tv/?token={}&kp={}", token, kp_id),
        format!("http://api.alloha.tv/?token={}&kp={}", token, kp_id),
    ];
    for url in &urls {
        match alloha_http_client()
            .get(url)
            .header("Accept", "application/json")
            .header("User-Agent", "NeoMovies/2.0 (+https://neomovies.ru)")
            .send()
            .await
        {
            Ok(resp) => {
                resp_opt = Some(resp);
                break;
            }
            Err(err) => last_err = Some(err.to_string()),
        }
    }

    let resp = match resp_opt {
        Some(r) => r,
        None => return Err(format!("alloha request failed: {}", last_err.unwrap_or_else(|| "unknown error".to_string()))),
    };

    if !resp.status().is_success() {
        return Err("not_found".to_string());
    }

    let payload: Value = resp
        .json()
        .await
        .map_err(|_| "not_found".to_string())?;

    if payload.get("status").and_then(Value::as_str) != Some("success") {
        return Err("not_found".to_string());
    }

    let data = payload.get("data").unwrap_or(&Value::Null);
    let iframe_code = pick_alloha_iframe(data, season, episode).ok_or_else(|| "not_found".to_string())?;

    // If it's a plain URL (no HTML tags), wrap it in an iframe
    let html = if !iframe_code.contains('<') {
        iframe_html(&iframe_code, "Alloha Player")
    } else {
        // Already HTML — wrap in a full document
        let cleaned = iframe_code.replace("\\\"", "\"").replace("\\'", "'");
        format!(
            "<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'/><title>Alloha Player</title><style>html,body{{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}}iframe,video{{display:block !important;position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important;border:0 !important;background:#000 !important;max-width:none !important;max-height:none !important;}}*{{box-sizing:border-box;}}</style></head><body>{}</body></html>",
            cleaned
        )
    };

    Ok(html)
}

// ── Lumex ─────────────────────────────────────────────────────────────────────

/// Returns HTML iframe page for Lumex player by KP ID.
/// Returns Err("not_configured") if LUMEX_URL is missing.
pub async fn get_lumex_player(kp_id: u64, lumex_url: &str) -> Result<String, String> {
    if lumex_url.is_empty() {
        return Err("not_configured".to_string());
    }

    let separator = if lumex_url.contains('?') { "&" } else { "?" };
    let player_url = format!("{}{}kp_id={}", lumex_url, separator, kp_id);
    Ok(iframe_html(&player_url, "Lumex Player"))
}

// ── Vibix ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct VibixResponse {
    id: Option<serde_json::Value>,
    iframe_url: Option<String>,
}

/// Returns HTML iframe page for Vibix player by KP ID.
pub async fn get_vibix_player(kp_id: u64, host: &str, token: &str) -> Result<String, String> {
    if token.is_empty() {
        return Err("not_configured".to_string());
    }

    let vibix_host = if host.is_empty() { "https://vibix.org" } else { host };
    let url = format!("{}/api/v1/publisher/videos/kinopoisk/{}", vibix_host, kp_id);

    let resp = http_client()
        .get(&url)
        .header("Accept", "application/json")
        .header("Authorization", token)
        .send()
        .await
        .map_err(|e| format!("vibix request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err("not_found".to_string());
    }

    let data: VibixResponse = resp
        .json()
        .await
        .map_err(|_| "not_found".to_string())?;

    if data.id.is_none() {
        return Err("not_found".to_string());
    }

    let iframe_url = data
        .iframe_url
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "not_found".to_string())?;

    Ok(iframe_html(&iframe_url, "Vibix Player"))
}

// ── HDVB ──────────────────────────────────────────────────────────────────────

/// Returns HTML iframe page for HDVB player by KP ID.
pub async fn get_hdvb_player(kp_id: u64, token: &str) -> Result<String, String> {
    if token.is_empty() {
        return Err("not_configured".to_string());
    }

    let url = format!("https://apivb.com/api/videos.json?id_kp={}&token={}", kp_id, token);

    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("hdvb request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err("not_found".to_string());
    }

    let data: Vec<serde_json::Value> = resp
        .json()
        .await
        .map_err(|_| "not_found".to_string())?;

    let iframe_url = data
        .first()
        .and_then(|v| v.get("iframe_url"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "not_found".to_string())?
        .to_string();

    Ok(iframe_html(&iframe_url, "HDVB Player"))
}

// ── Collaps ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CollapsListResponse {
    results: Option<Vec<CollapsResult>>,
}

#[derive(Deserialize)]
struct CollapsResult {
    #[serde(rename = "type")]
    result_type: Option<String>,
    iframe_url: Option<String>,
    seasons: Option<Vec<CollapsSeason>>,
}

#[derive(Deserialize)]
struct CollapsSeason {
    season: Option<i32>,
    episodes: Option<Vec<CollapsEpisode>>,
}

#[derive(Deserialize)]
struct CollapsEpisode {
    episode: Option<serde_json::Value>, // can be int or string
    iframe_url: Option<String>,
}

impl CollapsEpisode {
    fn episode_num(&self) -> i32 {
        match &self.episode {
            Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(0) as i32,
            Some(serde_json::Value::String(s)) => s.parse().unwrap_or(0),
            _ => 0,
        }
    }
}

/// Returns HTML iframe page for Collaps player by KP ID.
/// Optionally filters by season/episode for TV shows.
pub async fn get_collaps_player(
    kp_id: u64,
    host: &str,
    token: &str,
    season: Option<u32>,
    episode: Option<u32>,
) -> Result<String, String> {
    if host.is_empty() || token.is_empty() {
        return Err("not_configured".to_string());
    }

    let url = format!(
        "{}/list?token={}&kinopoisk_id={}",
        host.trim_end_matches('/'),
        token,
        kp_id
    );

    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("collaps request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err("not_found".to_string());
    }

    let data: CollapsListResponse = resp
        .json()
        .await
        .map_err(|_| "not_found".to_string())?;

    let results = data.results.unwrap_or_default();
    let result = results.into_iter().next().ok_or_else(|| "not_found".to_string())?;

    let iframe_url = if result.result_type.as_deref() == Some("series") {
        match (season, episode) {
            (Some(s), Some(e)) => {
                // Find specific episode
                result
                    .seasons
                    .as_deref()
                    .and_then(|seasons| {
                        seasons.iter().find(|season_obj| season_obj.season == Some(s as i32))
                    })
                    .and_then(|season_obj| season_obj.episodes.as_deref())
                    .and_then(|episodes| {
                        episodes.iter().find(|ep| ep.episode_num() == e as i32)
                    })
                    .and_then(|ep| ep.iframe_url.clone())
                    .ok_or_else(|| "not_found".to_string())?
            }
            (Some(s), None) => {
                // First episode of the season
                result
                    .seasons
                    .as_deref()
                    .and_then(|seasons| {
                        seasons.iter().find(|season_obj| season_obj.season == Some(s as i32))
                    })
                    .and_then(|season_obj| season_obj.episodes.as_deref())
                    .and_then(|episodes| episodes.first())
                    .and_then(|ep| ep.iframe_url.clone())
                    .ok_or_else(|| "not_found".to_string())?
            }
            _ => {
                // Return series iframe_url or first episode
                result
                    .iframe_url
                    .or_else(|| {
                        result
                            .seasons
                            .as_deref()
                            .and_then(|s| s.first())
                            .and_then(|s| s.episodes.as_deref())
                            .and_then(|e| e.first())
                            .and_then(|e| e.iframe_url.clone())
                    })
                    .ok_or_else(|| "not_found".to_string())?
            }
        }
    } else {
        result.iframe_url.ok_or_else(|| "not_found".to_string())?
    };

    Ok(iframe_html(&iframe_url, "Collaps Player"))
}
