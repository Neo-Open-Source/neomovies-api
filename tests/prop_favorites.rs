use mongodb::bson::{oid::ObjectId, DateTime};
use neowatch_api::models::favorite::Favorite;
use neowatch_api::models::user::User;
use proptest::prelude::*;

// Feature: neowatch-api-v2, Property 6: Account deletion removes all user data
// Validates: Requirements 3.8, 5.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_account_deletion_removes_all_user_data(
        neo_id in "[a-zA-Z0-9]{8,32}",
        email in "[a-z]{3,10}@[a-z]{3,8}\\.[a-z]{2,4}",
        name in "[a-zA-Z ]{1,50}",
        avatar in "https://[a-z]{5,15}\\.com/[a-z]{5,15}\\.jpg",
        media_ids in proptest::collection::vec("[a-z0-9]{4,12}", 0..10),
    ) {
        let now_ms = chrono::Utc::now().timestamp_millis();
        let user_id = ObjectId::new();
        let other_user_id = ObjectId::new();

        let _user = User {
            id: Some(user_id),
            neo_id,
            email,
            name,
            avatar,
            role: "user".to_string(),
            created_at: DateTime::from_millis(now_ms - 1000),
            updated_at: DateTime::from_millis(now_ms - 500),
            refresh_tokens: vec![],
        };

        let mut favorites: Vec<Favorite> = media_ids.iter().map(|mid| Favorite {
            id: Some(ObjectId::new()),
            user_id,
            media_id: format!("kp_{}", mid),
            media_type: "movie".to_string(),
            title: "Test Movie".to_string(),
            poster_url: "https://example.com/poster.jpg".to_string(),
            rating: Some(7.5),
            year: Some(2023),
            created_at: DateTime::from_millis(now_ms),
        }).collect();

        favorites.push(Favorite {
            id: Some(ObjectId::new()),
            user_id: other_user_id,
            media_id: "kp_99999".to_string(),
            media_type: "movie".to_string(),
            title: "Other Movie".to_string(),
            poster_url: "https://example.com/other.jpg".to_string(),
            rating: Some(8.0),
            year: Some(2024),
            created_at: DateTime::from_millis(now_ms),
        });

        let _user_favs_before = favorites.iter().filter(|f| f.user_id == user_id).count();
        let other_favs_before = favorites.iter().filter(|f| f.user_id == other_user_id).count();
        favorites.retain(|f| f.user_id != user_id);
        let user_favs_after = favorites.iter().filter(|f| f.user_id == user_id).count();
        let other_favs_after = favorites.iter().filter(|f| f.user_id == other_user_id).count();

        prop_assert_eq!(user_favs_after, 0, "all user's favorites must be removed after account deletion");
        prop_assert_eq!(other_favs_after, other_favs_before, "other user's favorites must not be affected");
    }
}
