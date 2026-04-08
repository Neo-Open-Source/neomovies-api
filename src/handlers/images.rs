use crate::{bad_gateway, bad_request, internal_error, not_found, with_cors};
use vercel_runtime::{Response, ResponseBody};

fn build_kp_image_url(kind: &str, id: &str) -> Option<String> {
    let is_valid_kind = matches!(kind, "kp" | "kp_small" | "kp_big");
    let is_valid_id = !id.is_empty() && id.chars().all(|c| c.is_ascii_digit());
    if !is_valid_kind || !is_valid_id {
        return None;
    }
    Some(format!(
        "https://kinopoiskapiunofficial.tech/images/posters/{}/{}.jpg",
        kind, id
    ))
}

fn decode_url_param(input: &str) -> String {
    // input can already be decoded (axum), or percent-encoded (vercel query parsing).
    // Parse as query to leverage URL-decoding safely.
    let synthetic = format!("http://localhost/?url={}", input);
    if let Ok(url) = reqwest::Url::parse(&synthetic) {
        for (k, v) in url.query_pairs() {
            if k == "url" {
                return v.into_owned();
            }
        }
    }
    input.to_string()
}

pub async fn handle_proxy(url_param: &str) -> Response<ResponseBody> {
    let target_url = decode_url_param(url_param);
    let parsed = match reqwest::Url::parse(&target_url) {
        Ok(u) => u,
        Err(_) => return with_cors(bad_request("invalid url")),
    };
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return with_cors(bad_request("invalid url scheme"));
    }

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(_) => return with_cors(internal_error()),
    };

    let resp = match client
        .get(parsed)
        .header("User-Agent", "NeoMovies/2.0 (+https://neomovies.ru)")
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return with_cors(bad_gateway("upstream image error")),
    };

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return with_cors(not_found("image not found"));
    }
    if !resp.status().is_success() {
        return with_cors(bad_gateway("upstream image error"));
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => return with_cors(bad_gateway("upstream image error")),
    };

    let response = Response::builder()
        .status(200)
        .header("Content-Type", content_type)
        .header("Cache-Control", "public, max-age=86400")
        .body(ResponseBody::from(bytes.to_vec()))
        .unwrap();

    with_cors(response)
}

pub async fn handle_kp(kind: &str, id: &str) -> Response<ResponseBody> {
    let url = match build_kp_image_url(kind, id) {
        Some(u) => u,
        None => return with_cors(bad_request("invalid image path")),
    };
    handle_proxy(&url).await
}
