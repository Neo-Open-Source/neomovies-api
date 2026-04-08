use serde::Serialize;
use serde_json::{json, Value};
use vercel_runtime::{Response, ResponseBody};

pub fn json_response(status: u16, body: Value) -> Response<ResponseBody> {
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .body(ResponseBody::from(body.to_string()))
        .unwrap()
}

pub fn success<T: Serialize>(data: T) -> Response<ResponseBody> {
    json_response(200, json!({ "success": true, "data": data }))
}

pub fn success_with_message<T: Serialize>(data: T, message: &str) -> Response<ResponseBody> {
    json_response(200, json!({ "success": true, "data": data, "message": message }))
}

pub fn bad_request(message: &str) -> Response<ResponseBody> {
    json_response(400, json!({ "error": message }))
}

pub fn unauthorized(message: &str) -> Response<ResponseBody> {
    json_response(401, json!({ "error": message }))
}

pub fn not_found(message: &str) -> Response<ResponseBody> {
    json_response(404, json!({ "error": message }))
}

pub fn internal_error() -> Response<ResponseBody> {
    json_response(500, json!({ "error": "internal server error" }))
}

pub fn bad_gateway(message: &str) -> Response<ResponseBody> {
    json_response(502, json!({ "error": message }))
}

pub fn with_cors(mut response: Response<ResponseBody>) -> Response<ResponseBody> {
    let headers = response.headers_mut();
    headers.insert("Access-Control-Allow-Origin", "*".parse().unwrap());
    headers.insert(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS".parse().unwrap(),
    );
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization".parse().unwrap(),
    );
    response
}
