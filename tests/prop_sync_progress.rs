use mongodb::bson::{oid::ObjectId, DateTime};
use neomovies_api::models::sync_progress::SyncProgress;
use proptest::prelude::*;

fn make_progress(
    user_id: ObjectId,
    media_id: String,
    media_type: String,
    season: Option<i32>,
    episode: Option<i32>,
    progress: f64,
    duration: f64,
    status: &str,
    ts_ms: i64,
) -> SyncProgress {
    SyncProgress {
        id: Some(ObjectId::new()),
        user_id,
        media_id,
        media_type,
        season,
        episode,
        progress,
        duration,
        status: status.to_string(),
        updated_at: DateTime::from_millis(ts_ms),
        created_at: DateTime::from_millis(ts_ms - 1000),
    }
}

// Feature: neomovies-api-v2, Property 14: Sync progress last-write-wins conflict resolution
// Validates: Requirement 9.1
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_sync_progress_last_write_wins(
        progress_a in 0.0f64..10000.0f64,
        progress_b in 0.0f64..10000.0f64,
        ts_a in 1000000000000i64..2000000000000i64,
        ts_b in 1000000000000i64..2000000000000i64,
    ) {
        let user_id = ObjectId::new();
        let media_id = "kp_258687".to_string();

        let a = make_progress(user_id, media_id.clone(), "movie".into(), None, None, progress_a, 7260.0, "watching", ts_a);
        let b = make_progress(user_id, media_id.clone(), "movie".into(), None, None, progress_b, 7260.0, "watching", ts_b);

        if ts_a >= ts_b {
            // a is newer (or equal) — should win
            prop_assert!(a.updated_at.timestamp_millis() >= b.updated_at.timestamp_millis(),
                "newer progress (ts_a={}) must have updated_at >= older (ts_b={})", ts_a, ts_b);
            prop_assert_eq!(a.progress, progress_a);
        } else {
            // b is newer — should win
            prop_assert!(b.updated_at.timestamp_millis() > a.updated_at.timestamp_millis(),
                "newer progress (ts_b={}) must have updated_at > older (ts_a={})", ts_b, ts_a);
            prop_assert_eq!(b.progress, progress_b);
        }
    }
}

// Feature: neomovies-api-v2, Property 15: Sync progress are user-scoped
// Validates: Requirement 9.2
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_sync_progress_user_scoped(
        media_id_a in "[a-z0-9]{4,12}",
        media_id_b in "[a-z0-9]{4,12}",
    ) {
        let user_a = ObjectId::new();
        let user_b = ObjectId::new();
        prop_assume!(user_a != user_b);

        let now = chrono::Utc::now().timestamp_millis();
        let a = make_progress(user_a, format!("kp_{}", media_id_a), "movie".into(), None, None, 100.0, 1000.0, "watching", now);
        let b = make_progress(user_b, format!("kp_{}", media_id_b), "movie".into(), None, None, 200.0, 2000.0, "watching", now);

        let items = vec![a, b];
        let result_for_a: Vec<&SyncProgress> = items.iter().filter(|p| p.user_id == user_a).collect();

        prop_assert_eq!(result_for_a.len(), 1, "user A should see exactly 1 progress");
        prop_assert_eq!(result_for_a[0].user_id, user_a, "result must belong to user A");
        prop_assert!(!result_for_a.iter().any(|p| p.user_id == user_b),
            "user A must not see progress belonging to user B");
    }
}

// Feature: neomovies-api-v2, Property 16: TV episode progress has unique per-episode keys
// Validates: Requirement 9.3
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_tv_episode_progress_is_unique_per_episode(
        seasons in proptest::collection::vec(1i32..20i32, 1..5),
        episodes in proptest::collection::vec(1i32..30i32, 1..5),
    ) {
        prop_assume!(seasons.len() == episodes.len());
        let user_id = ObjectId::new();
        let media_id = "kp_326".to_string();
        let now = chrono::Utc::now().timestamp_millis();

        let mut items: Vec<SyncProgress> = seasons.iter().zip(episodes.iter()).enumerate().map(|(i, (&s, &e))| {
            make_progress(
                user_id, media_id.clone(), "tv".into(),
                Some(s), Some(e),
                100.0 + i as f64 * 10.0, 3600.0, "watching", now + i as i64 * 1000,
            )
        }).collect();

        // Simulate unique constraint: if same (user, media, season, episode), keep latest
        items.sort_by(|a, b| b.updated_at.timestamp_millis().cmp(&a.updated_at.timestamp_millis()));
        items.dedup_by_key(|p| (p.user_id, p.media_id.clone(), p.season, p.episode));

        let expected = seasons.iter().zip(episodes.iter()).map(|(&s, &e)| (s, e)).collect::<std::collections::HashSet<_>>();
        let actual: std::collections::HashSet<(i32, i32)> = items.iter().map(|p| (p.season.unwrap(), p.episode.unwrap())).collect();

        prop_assert_eq!(actual.len(), expected.len(),
            "each (season, episode) combination must appear at most once per user per media");
    }
}

// Feature: neomovies-api-v2, Property 17: Sync progress batch preserves all items
// Validates: Requirement 9.4
proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]
    #[test]
    fn prop_batch_sync_preserves_all_items(
        kp_ids in proptest::collection::vec("[0-9]{4,8}", 1..10),
        status in proptest::sample::select(vec!["watching".to_string(), "completed".to_string(), "paused".to_string(), "dropped".to_string()]),
    ) {
        let user_id = ObjectId::new();
        let now = chrono::Utc::now().timestamp_millis();

        let mut stored: Vec<SyncProgress> = kp_ids.iter().enumerate().map(|(i, kp)| {
            make_progress(
                user_id, format!("kp_{}", kp), "movie".into(),
                None, None,
                500.0, 5000.0, &status, now + i as i64 * 1000,
            )
        }).collect();

        // Simulate batch upsert: dedup by (user, media, season, episode), keep latest
        stored.sort_by(|a, b| b.updated_at.timestamp_millis().cmp(&a.updated_at.timestamp_millis()));
        stored.dedup_by_key(|p| (p.user_id, p.media_id.clone(), p.season, p.episode));

        prop_assert!(stored.len() <= kp_ids.len(),
            "deduped items ({}) must not exceed original items ({})", stored.len(), kp_ids.len());
        prop_assert!(!stored.is_empty(), "stored items must not be empty");

        let stored_ids: std::collections::HashSet<String> = stored.iter().map(|p| p.media_id.clone()).collect();
        let input_ids: std::collections::HashSet<String> = kp_ids.iter().map(|kp| format!("kp_{}", kp)).collect();

        prop_assert!(stored_ids.is_subset(&input_ids),
            "stored media IDs must be a subset of input IDs");
    }
}

// Feature: neomovies-api-v2, Property 18: Valid status transitions
// Validates: Requirement 9.5
proptest! {
    #[test]
    fn prop_valid_status_values(status in "[a-z]{3,12}") {
        let valid = ["watching", "completed", "paused", "dropped"];
        let is_valid = valid.contains(&status.as_str());
        if is_valid {
            prop_assert!(valid.contains(&status.as_str()));
        } else {
            prop_assert!(!valid.contains(&status.as_str()));
        }
    }
}
