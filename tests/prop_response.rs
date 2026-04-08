use neomovies_api::{json_response, with_cors};
use proptest::prelude::*;

// Feature: neomovies-api-v2, Property 13: CORS headers present on every response
// Validates: Requirement 1.5
proptest! {
    #[test]
    fn cors_headers_present_on_every_response(status in 200u16..600u16) {
        let resp = with_cors(json_response(status, serde_json::json!({})));
        let headers = resp.headers();
        prop_assert!(headers.contains_key("access-control-allow-origin"));
        prop_assert_eq!(
            headers.get("access-control-allow-origin").unwrap(),
            "*"
        );
    }
}
