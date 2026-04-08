use neomovies_api::handlers::{
    auth, favorites, health, images, media, players, search, support, torrents, webhook,
};
use neomovies_api::{not_found, with_cors};
use http_body_util::BodyExt;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

#[tokio::main]
async fn main() -> Result<(), Error> {
    Ok(run(service_fn(handler)).await?)
}

fn parse_query(query_str: &str) -> Vec<(String, String)> {
    query_str
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.to_string();
            let val = parts.next().unwrap_or("").to_string();
            if key.is_empty() {
                None
            } else {
                Some((key, val))
            }
        })
        .collect()
}

fn q<'a>(params: &'a [(String, String)], key: &str) -> Option<&'a str> {
    params.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
}

pub async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let params = parse_query(req.uri().query().unwrap_or(""));
    let route = q(&params, "route").unwrap_or("");
    let method = req.method().as_str().to_string();
    let headers = req.headers().clone();

    let resp = match route {
        "health" => health::handle().await,
        "support" => support::handle().await,

        "auth_login" => {
            let body = req.into_body();
            let bytes = body.collect().await.map(|c| c.to_bytes()).unwrap_or_default();
            auth::handle_login(&bytes).await
        }
        "auth_callback" => {
            let body = req.into_body();
            let bytes = body.collect().await.map(|c| c.to_bytes()).unwrap_or_default();
            auth::handle_callback(&bytes).await
        }
        "auth_refresh" => {
            let body = req.into_body();
            let bytes = body.collect().await.map(|c| c.to_bytes()).unwrap_or_default();
            auth::handle_refresh(&bytes).await
        }
        "auth_profile" => {
            if method == "GET" {
                auth::handle_profile_get(&headers).await
            } else if method == "PUT" {
                let body = req.into_body();
                let bytes = body.collect().await.map(|c| c.to_bytes()).unwrap_or_default();
                auth::handle_profile_put(&headers, &bytes).await
            } else {
                with_cors(not_found("not found"))
            }
        }
        "auth_delete" => auth::handle_delete(&headers).await,
        "auth_revoke" => {
            let body = req.into_body();
            let bytes = body.collect().await.map(|c| c.to_bytes()).unwrap_or_default();
            auth::handle_revoke(&headers, &bytes).await
        }
        "auth_revoke_all" => auth::handle_revoke_all(&headers).await,
        "webhook_neoid" => {
            let body = req.into_body();
            let bytes = body.collect().await.map(|c| c.to_bytes()).unwrap_or_default();
            let body_str = String::from_utf8_lossy(&bytes).to_string();
            webhook::handle_neoid(&body_str).await
        }

        "search" => {
            let query = q(&params, "query").unwrap_or("");
            let page = q(&params, "page")
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(1);
            search::handle(query, page).await
        }
        "media_popular" => {
            let page = q(&params, "page")
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(1);
            media::handle_popular(page).await
        }
        "media_top_rated" => {
            let page = q(&params, "page")
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(1);
            media::handle_top_rated(page).await
        }
        "media_tv_top_rated" => {
            let page = q(&params, "page")
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(1);
            media::handle_top_rated_tv(page).await
        }
        "media_film" => {
            let id = q(&params, "id").unwrap_or("");
            media::handle_film(id).await
        }

        "image_proxy" => {
            let url = q(&params, "url").unwrap_or("");
            images::handle_proxy(url).await
        }
        "image_kp" => {
            let kind = q(&params, "kind").unwrap_or("");
            let id = q(&params, "id").unwrap_or("");
            images::handle_kp(kind, id).await
        }

        "player" => {
            let provider = q(&params, "provider").unwrap_or("");
            let kp_id = match q(&params, "kp_id").and_then(|s| s.parse::<u64>().ok()) {
                Some(v) => v,
                None => return Ok(with_cors(not_found("video not found"))),
            };
            let season = q(&params, "season").and_then(|s| s.parse::<u32>().ok());
            let episode = q(&params, "episode").and_then(|s| s.parse::<u32>().ok());
            players::handle(provider, kp_id, season, episode).await
        }

        "torrents" => {
            let kp_id = q(&params, "kp_id").unwrap_or("");
            let season = q(&params, "season").and_then(|s| s.parse::<u32>().ok());
            let episode = q(&params, "episode").and_then(|s| s.parse::<u32>().ok());
            torrents::handle(kp_id, season, episode).await
        }

        "favorites" => {
            let media_type = q(&params, "type").unwrap_or("movie");
            let kp_id = q(&params, "kp_id").unwrap_or("");
            let sub = q(&params, "sub").unwrap_or("");
            match (method.as_str(), kp_id.is_empty(), sub) {
                ("GET", true, _) => favorites::handle_list(&headers).await,
                ("GET", false, "check") => favorites::handle_check(&headers, kp_id, media_type).await,
                ("POST", false, _) => favorites::handle_add(&headers, kp_id, media_type).await,
                ("DELETE", false, _) => favorites::handle_remove(&headers, kp_id, media_type).await,
                _ => with_cors(not_found("not found")),
            }
        }

        _ => with_cors(not_found("not found")),
    };

    Ok(resp)
}
