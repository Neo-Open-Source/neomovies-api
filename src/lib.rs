pub mod config;
pub mod db;
pub mod auth;
pub mod models;
pub mod services;
pub mod response;
pub mod handlers;

pub use config::Config;
pub use response::{success, success_with_message, bad_request, unauthorized, not_found, internal_error, bad_gateway, with_cors, json_response};

/// Returns true if the search query is invalid (empty or whitespace-only).
pub fn is_empty_query(query: &str) -> bool {
    query.trim().is_empty()
}
