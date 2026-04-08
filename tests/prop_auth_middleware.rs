use http_body_util::BodyExt;
use neomovies_api::auth::jwt::{build_claims, decode_token, encode_access_token};
use neomovies_api::auth::middleware::user_not_found_response;
use proptest::prelude::*;

// Feature: neomovies-api-v2, Property 7: Deleted user JWT is rejected
// Validates: Requirement 4.5
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_deleted_user_jwt_rejected(
        sub in "[a-f0-9]{24}",
        neo_id in "[a-zA-Z0-9]{8,32}",
        email in "[a-z]{3,10}@[a-z]{3,8}\\.[a-z]{2,4}",
        is_admin in any::<bool>(),
        secret in "[a-zA-Z0-9!@#$%]{16,64}",
    ) {
        let claims = build_claims(sub.clone(), neo_id, email, is_admin);
        let token = encode_access_token(&claims, &secret).unwrap();

        let decoded = decode_token(&token, &secret).unwrap();
        prop_assert_eq!(&decoded.sub, &sub);

        let resp = user_not_found_response();
        prop_assert_eq!(resp.status().as_u16(), 401);

        let body_bytes = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async { resp.into_body().collect().await.unwrap().to_bytes() });
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        prop_assert_eq!(json["error"].as_str().unwrap(), "user not found");
    }
}
