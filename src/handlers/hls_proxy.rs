use reqwest::Client;
use vercel_runtime::{Response, ResponseBody};
use crate::with_cors;

fn client() -> Client {
    Client::builder().redirect(reqwest::redirect::Policy::limited(5)).build().unwrap()
}

fn decode_url(s: &str) -> String {
    url::form_urlencoded::parse(s.as_bytes())
        .next()
        .map(|(k, _)| k.into_owned())
        .unwrap_or_else(|| s.to_string())
}

fn extract_base(url: &str) -> String {
    if let Some(pos) = url.find("://") {
        let after = &url[pos + 3..];
        if let Some(slash) = after.find('/') {
            return format!("https://{}", &after[..slash]);
        }
    }
    url.to_string()
}

fn patch_m3u8(content: &str, base: &str) -> String {
    content.lines().map(|line| {
        let t = line.trim();
        if t.starts_with('#') {
            if t.contains("URI=\"") { rewrite_uri_attrs(line, base) } else { line.to_string() }
        } else if !t.is_empty() {
            make_absolute(t, base)
        } else {
            line.to_string()
        }
    }).collect::<Vec<_>>().join("\n")
}

fn rewrite_uri_attrs(line: &str, base: &str) -> String {
    let mut out = String::new();
    let mut rest = line;
    while let Some(pos) = rest.find("URI=\"") {
        out.push_str(&rest[..pos + 5]);
        rest = &rest[pos + 5..];
        if let Some(end) = rest.find('"') {
            out.push_str(&make_absolute(&rest[..end], base));
            out.push('"');
            rest = &rest[end + 1..];
        }
    }
    out.push_str(rest);
    out
}

fn make_absolute(uri: &str, base: &str) -> String {
    if uri.starts_with("http") { uri.to_string() }
    else if uri.starts_with('/') { format!("{}{}", base, uri) }
    else { format!("{}/{}", base.trim_end_matches('/'), uri) }
}

pub async fn handle_proxy(url_param: &str) -> Response<ResponseBody> {
    let url = decode_url(url_param);
    if url.is_empty() { return err_resp(400, "missing url param"); }

    let resp = match client().get(&url).send().await {
        Ok(r) => r,
        Err(e) => return err_resp(502, &e.to_string()),
    };

    let final_url = resp.url().to_string();
    let base = extract_base(&final_url);
    let status = resp.status().as_u16();
    if status != 200 { return err_resp(status, &format!("upstream {}", status)); }

    let body = match resp.text().await {
        Ok(t) => t,
        Err(e) => return err_resp(502, &e.to_string()),
    };

    with_cors(Response::builder()
        .status(200)
        .header("Content-Type", "application/vnd.apple.mpegurl")
        .header("Access-Control-Allow-Origin", "*")
        .body(ResponseBody::from(patch_m3u8(&body, &base)))
        .unwrap())
}

fn err_resp(status: u16, msg: &str) -> Response<ResponseBody> {
    with_cors(Response::builder()
        .status(status)
        .header("Content-Type", "text/plain")
        .body(ResponseBody::from(msg.to_string()))
        .unwrap())
}
