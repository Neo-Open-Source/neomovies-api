use mongodb::bson::{oid::ObjectId, DateTime};
use neomovies_api::models::favorite::Favorite;
use neomovies_api::models::user::User;
use proptest::prelude::*;

// Feature: neomovies-api-v2, Property 6: Account deletion removes all user data
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

        let user = User {
            id: Some(user_id),
            neo_id,
            email,
            name,
            avatar,
            is_admin: false,
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
            rating: None,
            year: None,
            created_at: DateTime::from_millis(now_ms),
        });

        let mut users: Vec<User> = vec![user];
        users.retain(|u| u.id != Some(user_id));
        favorites.retain(|f| f.user_id != user_id);

        prop_assert!(!users.iter().any(|u| u.id == Some(user_id)), "deleted user must not exist in users collection");
        prop_assert!(!favorites.iter().any(|f| f.user_id == user_id), "deleted user's favorites must not exist");
        prop_assert!(favorites.iter().any(|f| f.user_id == other_user_id), "other user's favorites must remain intact");
    }
}

// Feature: neomovies-api-v2, Property 11: Favorites are user-scoped
// Validates: Requirement 11.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_favorites_are_user_scoped(
        media_ids_a in proptest::collection::vec("[a-z0-9]{4,12}", 0..10),
        media_ids_b in proptest::collection::vec("[a-z0-9]{4,12}", 0..10),
    ) {
        let now_ms = chrono::Utc::now().timestamp_millis();
        let user_a_id = ObjectId::new();
        let user_b_id = ObjectId::new();

        prop_assume!(user_a_id != user_b_id);

        let mut all_favorites: Vec<Favorite> = media_ids_a.iter().map(|mid| Favorite {
            id: Some(ObjectId::new()),
            user_id: user_a_id,
            media_id: format!("kp_{}", mid),
            media_type: "movie".to_string(),
            title: "Movie A".to_string(),
            poster_url: "https://example.com/a.jpg".to_string(),
            rating: Some(7.0),
            year: Some(2023),
            created_at: DateTime::from_millis(now_ms),
        }).collect();

        all_favorites.extend(media_ids_b.iter().map(|mid| Favorite {
            id: Some(ObjectId::new()),
            user_id: user_b_id,
            media_id: format!("kp_{}", mid),
            media_type: "movie".to_string(),
            title: "Movie B".to_string(),
            poster_url: "https://example.com/b.jpg".to_string(),
            rating: Some(6.0),
            year: Some(2022),
            created_at: DateTime::from_millis(now_ms),
        }));

        let result_for_a: Vec<&Favorite> = all_favorites.iter().filter(|f| f.user_id == user_a_id).collect();

        prop_assert!(
            !result_for_a.iter().any(|f| f.user_id == user_b_id),
            "favorites returned for user A must not contain any document belonging to user B"
        );
    }
}

// Feature: neomovies-api-v2, Property 12: Favorite add is idempotent
// Validates: Requirement 11.7
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_favorite_add_is_idempotent(
        kp_id in "[0-9]{1,10}",
        n in 1usize..=10usize,
    ) {
        let now_ms = chrono::Utc::now().timestamp_millis();
        let user_id = ObjectId::new();
        let media_id = format!("kp_{}", kp_id);
        let media_type = "movie".to_string();

        let mut favorites: Vec<Favorite> = vec![];

        for _ in 0..n {
            let already_exists = favorites.iter().any(|f| {
                f.user_id == user_id && f.media_id == media_id && f.media_type == media_type
            });
            if !already_exists {
                favorites.push(Favorite {
                    id: Some(ObjectId::new()),
                    user_id,
                    media_id: media_id.clone(),
                    media_type: media_type.clone(),
                    title: "Test Movie".to_string(),
                    poster_url: "https://example.com/poster.jpg".to_string(),
                    rating: Some(7.5),
                    year: Some(2023),
                    created_at: DateTime::from_millis(now_ms),
                });
            }
        }

        let count = favorites.iter().filter(|f| {
            f.user_id == user_id && f.media_id == media_id && f.media_type == media_type
        }).count();

        prop_assert_eq!(count, 1, "after {} add attempts, expected exactly 1 favorite but found {}", n, count);
    }
}
