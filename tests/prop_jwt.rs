use neomovies_api::auth::jwt::{build_claims, decode_token, encode_access_token};
use proptest::prelude::*;

// Feature: neomovies-api-v2, Property 1: JWT claims completeness and expiry
// Validates: Requirements 2.7, 2.8
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_jwt_claims_completeness(
        sub in "[a-f0-9]{24}",
        neo_id in "[a-zA-Z0-9]{8,32}",
        email in "[a-z]{3,10}@[a-z]{3,8}\\.[a-z]{2,4}",
        is_admin in any::<bool>(),
        secret in "[a-zA-Z0-9!@#$%]{16,64}",
    ) {
        let claims = build_claims(sub.clone(), neo_id.clone(), email.clone(), is_admin);
        let token = encode_access_token(&claims, &secret).unwrap();
        let decoded = decode_token(&token, &secret).unwrap();

        prop_assert_eq!(&decoded.sub, &sub);
        prop_assert_eq!(&decoded.neo_id, &neo_id);
        prop_assert_eq!(&decoded.email, &email);
        prop_assert_eq!(decoded.is_admin, is_admin);
        prop_assert!(decoded.iat > 0);
        prop_assert!(decoded.exp > 0);
        prop_assert_eq!(decoded.exp - decoded.iat, 900);
    }
}

// Feature: neomovies-api-v2, Property 2: JWT round-trip verifiability
// Validates: Requirements 2.3, 2.8
proptest! {
    #[test]
    fn prop_jwt_round_trip(
        sub in "[a-f0-9]{24}",
        neo_id in "[a-zA-Z0-9]{8,32}",
        email in "[a-z]{3,10}@[a-z]{3,8}\\.[a-z]{2,4}",
        is_admin in any::<bool>(),
        secret in "[a-zA-Z0-9!@#$%]{16,64}",
    ) {
        let claims = build_claims(sub, neo_id, email, is_admin);
        let token = encode_access_token(&claims, &secret).unwrap();
        let decoded = decode_token(&token, &secret).unwrap();
        prop_assert_eq!(decoded, claims);
    }
}
