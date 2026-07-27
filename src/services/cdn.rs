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

fn api_client() -> Client {
    Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(std::time::Duration::from_secs(15))
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
    pub title: Option<String>,
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
    pub title: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CdnVideoDto {
    pub id: String,
    pub title: String,
    pub is_series: bool,
    pub m3u8_url: String,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub episodes: Vec<CdnEpisodeDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CdnEpisodeDto {
    pub season: u32,
    pub episode: u32,
    pub title: String,
    pub m3u8_url: String,
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

pub async fn resolve_cdn_id_by_kp(kp_id: u64) -> Result<u64, String> {
    let url = format!(
        "https://api.rstprgapipt.com/balancer-api/iframe?kp={}&token={}&disabled_share=1",
        kp_id, CDN_TOKEN
    );
    let html = api_client().get(&url).send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;

    let patterns = ["window.MOVIE_ID=", "data-movie-id=\"", "data-id=\""];
    for pattern in &patterns {
        if let Some(id) = html.split(pattern)
            .nth(1)
            .and_then(|s| s.split(|c| c == ';' || c == '"').next())
            .and_then(|s| s.trim().parse::<u64>().ok())
        {
            return Ok(id);
        }
    }

    Err(format!("CDN id not found in iframe HTML (kp={})", kp_id))
}

fn proxy_url(filepath: &str) -> String {
    if filepath.ends_with(".m3u8") {
        format!("/api/v1/hls/proxy?url={}", urlencoding::encode(filepath))
    } else {
        filepath.to_string()
    }
}

pub fn variant_title(v: &EpisodeVariant) -> String {
    v.title.clone().unwrap_or_default()
}

pub async fn get_player_data(cdn_id: u64, season: Option<u32>, episode: Option<u32>) -> Result<CdnVideoDto, String> {
    let info = get_content_info(cdn_id).await?;
    let id = format!("cp_{}", cdn_id);

    let episodes_raw = get_episodes(cdn_id).await.unwrap_or_default();

    if episodes_raw.is_empty() {
        let filepath = info.trailer_urls.first().ok_or("no video")?.clone();
        return Ok(CdnVideoDto {
            id,
            title: info.title,
            is_series: false,
            m3u8_url: proxy_url(&filepath),
            season: None,
            episode: None,
            episodes: vec![],
        });
    }

    let is_series = info.has_multiple_episodes;

    let target_season = season.unwrap_or(1);
    let target_episode = episode.unwrap_or(1);

    let initial_ep = if is_series {
        episodes_raw.iter()
            .find(|e| e.season.order == target_season && e.order == target_episode)
            .or_else(|| episodes_raw.first())
    } else {
        episodes_raw.first()
    }.ok_or("no episodes")?;

    let initial_variant = initial_ep.episode_variants.first().ok_or("no variants")?;
    let initial_url = proxy_url(&initial_variant.filepath);
    let actual_season = initial_ep.season.order;
    let actual_episode = initial_ep.order;

    let mut episodes = Vec::new();
    for e in episodes_raw {
        if let Some(variant) = e.episode_variants.into_iter().next() {
            let ep_title = variant.title.as_deref().unwrap_or("").to_string();
            episodes.push(CdnEpisodeDto {
                season: e.season.order,
                episode: e.order,
                title: ep_title,
                m3u8_url: proxy_url(&variant.filepath),
            });
        }
    }

    let (out_season, out_episode) = if is_series && actual_season > 0 && actual_episode > 0 {
        (Some(actual_season), Some(actual_episode))
    } else {
        (None, None)
    };

    Ok(CdnVideoDto {
        id,
        title: info.title,
        is_series,
        m3u8_url: initial_url,
        season: out_season,
        episode: out_episode,
        episodes,
    })
}
