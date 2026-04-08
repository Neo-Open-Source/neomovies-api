use neomovies_api::is_empty_query;
use proptest::prelude::*;

fn whitespace_string() -> impl Strategy<Value = String> {
    prop::collection::vec(
        prop_oneof![Just(' '), Just('\t'), Just('\n'), Just('\r')],
        0..=20,
    )
    .prop_map(|chars| chars.into_iter().collect::<String>())
}

// Feature: neomovies-api-v2, Property 8: Empty/whitespace search query returns 400
// Validates: Requirement 6.3
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    #[test]
    fn prop_empty_or_whitespace_query_is_invalid(query in whitespace_string()) {
        prop_assert!(is_empty_query(&query), "Expected is_empty_query to return true for {:?}", query);
    }
}

#[test]
fn non_empty_query_is_valid() {
    assert!(!is_empty_query("inception"));
    assert!(!is_empty_query("  hello  "));
    assert!(!is_empty_query("a"));
}

#[test]
fn empty_string_is_invalid() {
    assert!(is_empty_query(""));
}

#[test]
fn pure_whitespace_variants_are_invalid() {
    assert!(is_empty_query(" "));
    assert!(is_empty_query("\t"));
    assert!(is_empty_query("\n"));
    assert!(is_empty_query("   \t\n  "));
}
