use reqwest::Client;
use serde::{Deserialize, Serialize};

const CDN_BASE: &str = "https://api.rstprgapipt.com/balancer-api/proxy/playlists/catalog-api";
const CDN_TOKEN: &str = "eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlIjoiMzQiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiNDEiLCJpYXQiOjE3NDMwNjA3ODAsImp0aSI6IjIzMTQwMmE0LTM3NTMtNGQ3OS1hNDBjLTA2YTY0MTE0MzNhOSIsInNjb3BlIjoiRExFIn0.4PmKGf512P-ov-tEjwr3gfOVxccjx8SSt28slJXypYU";

fn client() -> Client {
    Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap()
}

#[derive(Deserialize)]
pub struct ContentInfo {
    pub id: u64,
    pub title: String,
    #[serde(rename = "hasMultipleEpisodes")]
    pub has_multiple_episodes: bool,
    #[serde(rename = "trailerUrls", default)]
    pub trailer_urls: Vec<String>,
}

#[derive(Deserialize)]
pub struct Episode {
    pub id: u64,
    pub title: String,
    pub order: u32,
    pub season: EpisodeSeason,
    #[serde(rename = "episodeVariants", default)]
    pub episode_variants: Vec<EpisodeVariant>,
}

#[derive(Deserialize)]
pub struct EpisodeSeason {
    pub id: u64,
    pub order: u32,
}

#[derive(Deserialize)]
pub struct EpisodeVariant {
    pub filepath: String,
}

#[derive(Serialize)]
pub struct EpisodeJs {
    pub season: u32,
    pub episode: u32,
    pub title: String,
    pub filepath: String,
}

fn cdn_headers() -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert("DLE-API-TOKEN", CDN_TOKEN.parse().unwrap());
    h.insert("Iframe-Request-Id", "7f2a4c1b-ca44-4858-b6ab-71894c7bb1aa".parse().unwrap());
    h
}

pub async fn get_content_info(cdn_id: u64) -> Result<ContentInfo, String> {
    let url = format!("{}/contents/{}", CDN_BASE, cdn_id);
    let resp = client().get(&url).headers(cdn_headers()).send().await.map_err(|e| e.to_string())?;
    resp.json::<ContentInfo>().await.map_err(|e| e.to_string())
}

pub async fn get_episodes(cdn_id: u64) -> Result<Vec<Episode>, String> {
    let url = format!("{}/episodes?content-id={}", CDN_BASE, cdn_id);
    let resp = client().get(&url).headers(cdn_headers()).send().await.map_err(|e| e.to_string())?;
    resp.json::<Vec<Episode>>().await.map_err(|e| e.to_string())
}

pub async fn resolve_m3u8(filepath: &str) -> Result<String, String> {
    let resp = client().get(filepath).send().await.map_err(|e| e.to_string())?;
    if resp.status().as_u16() == 307 {
        return resp.headers().get("location")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .ok_or_else(|| "no location header".to_string());
    }
    Ok(filepath.to_string())
}

pub async fn resolve_cdn_id_by_kp(kp_id: u64) -> Result<u64, String> {
    let url = format!(
        "https://api.rstprgapipt.com/balancer-api/iframe?kp={}&token={}&disabled_share=1",
        kp_id, CDN_TOKEN
    );
    let html = Client::new().get(&url).send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;

    html.split("window.MOVIE_ID=")
        .nth(1)
        .and_then(|s| s.split(';').next())
        .and_then(|s| s.trim().parse::<u64>().ok())
        .ok_or_else(|| format!("MOVIE_ID not found in iframe HTML (kp={})", kp_id))
}

pub struct PlayerData {
    pub title: String,
    pub initial_m3u8: String,
    pub initial_season: u32,
    pub initial_episode: u32,
    pub episodes: Vec<EpisodeJs>,
    pub is_series: bool,
}

pub async fn get_player_data(cdn_id: u64, season: Option<u32>, episode: Option<u32>) -> Result<PlayerData, String> {
    let info = get_content_info(cdn_id).await?;

    if !info.has_multiple_episodes {
        let filepath = info.trailer_urls.first().ok_or("no video")?.clone();
        let m3u8 = resolve_m3u8(&filepath).await?;
        return Ok(PlayerData { title: info.title, initial_m3u8: m3u8, initial_season: 0, initial_episode: 0, episodes: vec![], is_series: false });
    }

    let raw_episodes = get_episodes(cdn_id).await?;
    let target_season = season.unwrap_or(1);
    let target_episode = episode.unwrap_or(1);

    let initial_ep = raw_episodes.iter()
        .find(|e| e.season.order == target_season && e.order == target_episode)
        .or_else(|| raw_episodes.first())
        .ok_or("no episodes")?;

    let initial_filepath = initial_ep.episode_variants.first().ok_or("no variants")?.filepath.clone();
    let initial_m3u8 = resolve_m3u8(&initial_filepath).await?;
    let actual_season = initial_ep.season.order;
    let actual_episode = initial_ep.order;

    let episodes: Vec<EpisodeJs> = raw_episodes.into_iter().filter_map(|e| {
        let fp = e.episode_variants.into_iter().next()?.filepath;
        Some(EpisodeJs { season: e.season.order, episode: e.order, title: e.title, filepath: fp })
    }).collect();

    Ok(PlayerData { title: info.title, initial_m3u8, initial_season: actual_season, initial_episode: actual_episode, episodes, is_series: true })
}
