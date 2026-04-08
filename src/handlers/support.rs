use crate::with_cors;
use vercel_runtime::{Response, ResponseBody};

const SUPPORTERS: &str = r#"[
  {"id":1,"name":"Sophron Ragozin","type":"service","description":"Покупка и продления основного домена neomovies.ru","contributions":["Домен neomovies.ru"],"year":2025,"isActive":true},
  {"id":2,"name":"Chernuha","type":"service","description":"Покупка домена neomovies.run","contributions":["Домен neomovies.run"],"year":2025,"isActive":true},
  {"id":3,"name":"Iwnuply","type":"code","description":"Создание докер контейнера для API и Frontend","contributions":["Docker"],"year":2025,"isActive":true}
]"#;

pub async fn handle() -> Response<ResponseBody> {
    let body = format!(r#"{{"success":true,"data":{}}}"#, SUPPORTERS);
    let resp = Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(body))
        .unwrap();
    with_cors(resp)
}
