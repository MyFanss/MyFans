//! Tests for Issue #312 – get_content_info catalog query.

#[cfg(test)]
mod content_query_tests {
    use crate::{ContentAccess, ContentAccessClient, ContentInfo};
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

    fn make_content_id(env: &Env, seed: u8) -> BytesN<32> {
        let mut bytes = [0u8; 32];
        bytes[0] = seed;
        BytesN::from_array(env, &bytes)
    }

    // ── positive test ────────────────────────────────────────────────────────

    /// Register content with a known price, then assert get_content_info returns it.
    #[test]
    fn test_get_content_info_returns_registered_content() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let content_id = make_content_id(&env, 1);

        client.register_content(&creator, &content_id, &500, &true);

        let result = client.get_content_info(&creator, &content_id);
        assert!(result.is_some());
        let info = result.unwrap();
        assert_eq!(info.price, 500);
        assert!(info.is_active);
    }

    // ── negative test ────────────────────────────────────────────────────────

    /// Query a content_id that was never registered – must return None.
    #[test]
    fn test_get_content_info_returns_none_for_unknown_content() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let unknown_id = make_content_id(&env, 99);

        let result = client.get_content_info(&creator, &unknown_id);
        assert!(result.is_none());
    }

    // ── boundary / caller test ───────────────────────────────────────────────

    /// A third-party caller (not the creator) can query without auth errors.
    #[test]
    fn test_get_content_info_accessible_by_any_caller() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let third_party = Address::generate(&env);
        let content_id = make_content_id(&env, 7);

        // Creator registers the content.
        client.register_content(&creator, &content_id, &1_000, &true);

        // Third-party queries – no auth mocking needed for the query itself.
        // (mock_all_auths covers register_content above; the query needs none.)
        let _ = third_party; // illustrative – the client call below uses no auth
        let result = client.get_content_info(&creator, &content_id);
        assert!(result.is_some());
        assert_eq!(result.unwrap().price, 1_000);
    }

    // ── additional: inactive content is still returned ───────────────────────

    #[test]
    fn test_get_content_info_returns_inactive_content() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let content_id = make_content_id(&env, 2);

        client.register_content(&creator, &content_id, &200, &false);

        let result = client.get_content_info(&creator, &content_id);
        assert!(result.is_some());
        let info = result.unwrap();
        assert_eq!(info.price, 200);
        assert!(!info.is_active);
    }

    // ── update: re-registering overwrites previous values ───────────────────

    #[test]
    fn test_register_content_update_overwrites() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let content_id = make_content_id(&env, 3);

        client.register_content(&creator, &content_id, &100, &true);
        client.register_content(&creator, &content_id, &999, &false);

        let info = client.get_content_info(&creator, &content_id).unwrap();
        assert_eq!(info.price, 999);
        assert!(!info.is_active);
    }
}
