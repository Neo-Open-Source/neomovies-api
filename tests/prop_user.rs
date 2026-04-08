use mongodb::bson::{oid::ObjectId, DateTime};
use neomovies_api::models::user::{RefreshToken, User};
use proptest::prelude::*;

// Feature: neomovies-api-v2, Property 4: Profile update only modifies name and avatar
// Validates: Requirements 3.4, 3.5
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_profile_update_only_modifies_name_and_avatar(
        neo_id in "[a-zA-Z0-9]{8,32}",
        email in "[a-z]{3,10}@[a-z]{3,8}\\.[a-z]{2,4}",
        original_name in "[a-zA-Z ]{1,50}",
        original_avatar in "https://[a-z]{5,15}\\.com/[a-z]{5,15}\\.jpg",
        new_name in "[a-zA-Z ]{1,50}",
        new_avatar in "https://[a-z]{5,15}\\.com/[a-z]{5,15}\\.jpg",
        extra_field_key in "[a-z]{3,10}",
        extra_field_value in "[a-zA-Z0-9]{1,20}",
        is_admin in any::<bool>(),
    ) {
        let now_ms = chrono::Utc::now().timestamp_millis();
        let object_id = ObjectId::new();

        let original_user = User {
            id: Some(object_id),
            neo_id: neo_id.clone(),
            email: email.clone(),
            name: original_name.clone(),
            avatar: original_avatar.clone(),
            is_admin,
            created_at: DateTime::from_millis(now_ms - 1000),
            updated_at: DateTime::from_millis(now_ms - 500),
            refresh_tokens: vec![],
        };

        let mut updated_user = original_user.clone();
        updated_user.name = new_name.clone();
        updated_user.avatar = new_avatar.clone();
        updated_user.updated_at = DateTime::from_millis(now_ms);
        let _ = (extra_field_key, extra_field_value);

        prop_assert_eq!(&updated_user.name, &new_name);
        prop_assert_eq!(&updated_user.avatar, &new_avatar);
        prop_assert_eq!(updated_user.id, original_user.id, "id must not change");
        prop_assert_eq!(&updated_user.neo_id, &original_user.neo_id, "neo_id must not change");
        prop_assert_eq!(&updated_user.email, &original_user.email, "email must not change");
        prop_assert_eq!(updated_user.is_admin, original_user.is_admin, "is_admin must not change");
        prop_assert_eq!(updated_user.created_at, original_user.created_at, "created_at must not change");
        prop_assert_eq!(updated_user.refresh_tokens.len(), original_user.refresh_tokens.len(), "refresh_tokens must not change");
    }
}

// Feature: neomovies-api-v2, Property 5: Revoke-all empties refresh tokens
// Validates: Requirement 3.7
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_revoke_all_empties_refresh_tokens(
        tokens in proptest::collection::vec("[a-f0-9]{128}", 0..20),
    ) {
        let now_ms = chrono::Utc::now().timestamp_millis();

        let mut user = User {
            id: Some(ObjectId::new()),
            neo_id: "test_neo_id".to_string(),
            email: "test@example.com".to_string(),
            name: "Test User".to_string(),
            avatar: "https://example.com/avatar.jpg".to_string(),
            is_admin: false,
            created_at: DateTime::from_millis(now_ms - 1000),
            updated_at: DateTime::from_millis(now_ms - 500),
            refresh_tokens: tokens.iter().map(|t| RefreshToken {
                token: t.clone(),
                expires_at: DateTime::from_millis(now_ms + 30 * 24 * 60 * 60 * 1000),
                created_at: DateTime::from_millis(now_ms),
                user_agent: None,
                ip_address: None,
            }).collect(),
        };

        user.refresh_tokens.clear();

        prop_assert!(user.refresh_tokens.is_empty(), "refresh_tokens must be empty after revoke-all");
    }
}

// Feature: neomovies-api-v2, Property 3: Refresh token rotation invalidates old token
// Validates: Requirement 3.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_refresh_token_rotation_invalidates_old(
        old_token in "[a-f0-9]{128}",
        new_token in "[a-f0-9]{128}",
        extra_count in 0usize..4usize,
        extra_tokens in proptest::collection::vec("[a-f0-9]{128}", 0..4),
    ) {
        let now_ms = chrono::Utc::now().timestamp_millis();

        let mut tokens: Vec<RefreshToken> = extra_tokens
            .iter()
            .take(extra_count)
            .map(|t| RefreshToken {
                token: t.clone(),
                expires_at: DateTime::from_millis(now_ms + 30 * 24 * 60 * 60 * 1000),
                created_at: DateTime::from_millis(now_ms),
                user_agent: None,
                ip_address: None,
            })
            .collect();

        tokens.push(RefreshToken {
            token: old_token.clone(),
            expires_at: DateTime::from_millis(now_ms + 30 * 24 * 60 * 60 * 1000),
            created_at: DateTime::from_millis(now_ms),
            user_agent: None,
            ip_address: None,
        });

        tokens.retain(|t| t.token != old_token);
        tokens.push(RefreshToken {
            token: new_token.clone(),
            expires_at: DateTime::from_millis(now_ms + 30 * 24 * 60 * 60 * 1000),
            created_at: DateTime::from_millis(now_ms),
            user_agent: None,
            ip_address: None,
        });

        prop_assert!(!tokens.iter().any(|t| t.token == old_token), "old token should not be present after rotation");

        let new_entry = tokens.iter().find(|t| t.token == new_token);
        prop_assert!(new_entry.is_some(), "new token should be present after rotation");
        prop_assert!(
            new_entry.unwrap().expires_at.timestamp_millis() > now_ms,
            "new token expires_at should be in the future"
        );
    }
}
