use crate::with_cors;
use vercel_runtime::{Response, ResponseBody};

pub async fn handle() -> Response<ResponseBody> {
    let resp = Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(r#"{"status":"ok"}"#.to_string()))
        .unwrap();
    with_cors(resp)
}
