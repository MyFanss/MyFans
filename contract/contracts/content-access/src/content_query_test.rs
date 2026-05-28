//! Tests for content catalog query (get_content_price / set_content_price).

#[cfg(test)]
mod content_query_tests {
    use crate::{ContentAccess, ContentAccessClient};
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env};

    fn setup() -> (Env, Address) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| li.sequence_number = 1000);
        let contract_id = env.register_contract(None, ContentAccess);
        (env, contract_id)
    }

    // ── positive test ────────────────────────────────────────────────────────

    /// Set a price for content, then assert get_content_price returns it.
    #[test]
    fn test_get_content_price_returns_registered_price() {
        let (env, contract_id) = setup();
        let client = ContentAccessClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        client.set_content_price(&creator, &1, &500);

        let result = client.get_content_price(&creator, &1);
        assert_eq!(result, Some(500));
    }

    // ── negative test ────────────────────────────────────────────────────────

    /// Query a content_id that was never registered – must return None.
    #[test]
    fn test_get_content_price_returns_none_for_unknown_content() {
        let (env, contract_id) = setup();
        let client = ContentAccessClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let result = client.get_content_price(&creator, &99);
        assert!(result.is_none());
    }

    // ── boundary / caller test ───────────────────────────────────────────────

    /// A third-party caller can query price without auth errors (view-only).
    #[test]
    fn test_get_content_price_accessible_by_any_caller() {
        let (env, contract_id) = setup();
        let client = ContentAccessClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        client.set_content_price(&creator, &7, &1_000);

        let result = client.get_content_price(&creator, &7);
        assert_eq!(result, Some(1_000));
    }

    // ── update: re-setting overwrites previous value ─────────────────────────

    #[test]
    fn test_set_content_price_update_overwrites() {
        let (env, contract_id) = setup();
        let client = ContentAccessClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        client.set_content_price(&creator, &3, &100);
        client.set_content_price(&creator, &3, &999);

        assert_eq!(client.get_content_price(&creator, &3), Some(999));
    }

    // ── multiple creators ────────────────────────────────────────────────────

    #[test]
    fn test_prices_are_creator_scoped() {
        let (env, contract_id) = setup();
        let client = ContentAccessClient::new(&env, &contract_id);
        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);

        client.set_content_price(&creator1, &1, &100);
        client.set_content_price(&creator2, &1, &200);

        assert_eq!(client.get_content_price(&creator1, &1), Some(100));
        assert_eq!(client.get_content_price(&creator2, &1), Some(200));
    }
}
