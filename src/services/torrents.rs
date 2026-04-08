use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub struct JacredClient {
    client: reqwest::Client,
    base_url: String,
}

/// Raw torrent item from jacred API response.
#[derive(Debug, Deserialize)]
struct JacredTorrent {
    tracker: Option<String>,
    url: Option<String>,
    title: Option<String>,
    size: Option<Value>,
    #[serde(rename = "sizeName")]
    size_name: Option<String>,
    #[serde(rename = "createTime")]
    create_time: Option<String>,
    sid: Option<Value>,
    pir: Option<Value>,
    magnet: Option<String>,
    name: Option<String>,
    #[serde(rename = "originalname")]
    original_name: Option<String>,
    #[serde(rename = "relased")]
    released: Option<Value>,
    #[serde(rename = "videotype")]
    video_type: Option<String>,
    quality: Option<Value>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TorrentResult {
    pub tracker: String,
    pub url: String,
    pub title: String,
    pub size: i64,
    pub size_name: String,
    pub create_time: String,
    pub sid: i32,
    pub pir: i32,
    pub magnet: String,
    pub name: String,
    pub original_name: String,
    pub released: i32,
    pub video_type: String,
    pub quality: i32,
}

#[derive(Debug, Serialize)]
pub struct TorrentSearchResponse {
    pub results: Vec<TorrentResult>,
    pub total: usize,
}

impl JacredClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    /// Search torrents by KP ID via jacred.
    /// Uses `search=kp<kp_id>` param — gives more accurate results than title search.
    /// Optionally filters results by season and episode number.
    pub async fn search_by_kp_id(
        &self,
        kp_id: u64,
        season: Option<u32>,
        episode: Option<u32>,
    ) -> Result<TorrentSearchResponse, String> {
        let url = format!(
            "{}/api/v1.0/torrents?search=kp{}&apikey=null",
            self.base_url, kp_id
        );

        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .header("Accept-Language", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7")
            .header(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) \
                 AppleWebKit/537.36 (KHTML, like Gecko) \
                 Chrome/132.0.0.0 Mobile Safari/537.36",
            )
            .send()
            .await
            .map_err(|e| format!("jacred request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err("torrent service unavailable".to_string());
        }

        let raw: Value = resp
            .json()
            .await
            .map_err(|_| "failed to parse jacred response".to_string())?;

        let items: Vec<JacredTorrent> = match raw {
            Value::Array(arr) => serde_json::from_value(Value::Array(arr))
                .unwrap_or_default(),
            Value::Object(ref obj) => {
                if let Some(Value::Array(arr)) = obj.get("data") {
                    serde_json::from_value(Value::Array(arr.clone())).unwrap_or_default()
                } else {
                    vec![]
                }
            }
            _ => vec![],
        };

        // Deduplicate by magnet, keep only entries with sid > 0
        let mut seen: HashMap<String, TorrentResult> = HashMap::new();
        for item in items {
            let mapped = map_torrent(item);
            if mapped.sid > 0 && !mapped.magnet.is_empty() {
                seen.entry(mapped.magnet.clone()).or_insert(mapped);
            }
        }

        // Sort by sid desc, then pir desc (mirrors iOS logic)
        let mut results: Vec<TorrentResult> = seen.into_values().collect();
        results.sort_by(|a, b| {
            b.sid.cmp(&a.sid).then_with(|| b.pir.cmp(&a.pir))
        });

        // Filter by season/episode if provided
        if season.is_some() || episode.is_some() {
            results = results
                .into_iter()
                .filter(|r| {
                    let title_lower = r.title.to_lowercase();
                    let name_lower = r.name.to_lowercase();
                    let haystack = format!("{} {}", title_lower, name_lower);
                    let season_ok = season.map_or(true, |s| {
                        haystack.contains(&format!("s{:02}", s))
                            || haystack.contains(&format!("сезон {}", s))
                            || haystack.contains(&format!("season {}", s))
                    });
                    let episode_ok = episode.map_or(true, |e| {
                        haystack.contains(&format!("e{:02}", e))
                            || haystack.contains(&format!("серия {}", e))
                            || haystack.contains(&format!("episode {}", e))
                    });
                    season_ok && episode_ok
                })
                .collect();
        }

        let total = results.len();
        Ok(TorrentSearchResponse { results, total })
    }
}

fn map_torrent(t: JacredTorrent) -> TorrentResult {
    TorrentResult {
        tracker: t.tracker.unwrap_or_default(),
        url: t.url.unwrap_or_default(),
        title: t.title.unwrap_or_default(),
        size: value_to_i64(t.size.as_ref()),
        size_name: t.size_name.unwrap_or_default(),
        create_time: t.create_time.unwrap_or_default(),
        sid: value_to_i32(t.sid.as_ref()),
        pir: value_to_i32(t.pir.as_ref()),
        magnet: t.magnet.unwrap_or_default(),
        name: t.name.unwrap_or_default(),
        original_name: t.original_name.unwrap_or_default(),
        released: value_to_i32(t.released.as_ref()),
        video_type: t.video_type.unwrap_or_default(),
        quality: value_to_i32(t.quality.as_ref()),
    }
}

fn value_to_i32(v: Option<&Value>) -> i32 {
    match v {
        Some(Value::Number(n)) => n.as_i64().unwrap_or(0) as i32,
        Some(Value::String(s)) => s.parse().unwrap_or(0),
        _ => 0,
    }
}

fn value_to_i64(v: Option<&Value>) -> i64 {
    match v {
        Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
        Some(Value::String(s)) => s.parse().unwrap_or(0),
        _ => 0,
    }
}
