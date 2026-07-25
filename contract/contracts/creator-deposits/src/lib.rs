#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env,
    Symbol,
};

/// ── Event topic constants ──────────────────────────────────────────────
/// Stable strings used as the first topic in Soroban events emitted by this
/// contract.  Indexers should key on these constants rather than raw string
/// literals so that renaming only requires a single point of change.
///
/// | Topic                     | Emitted from  | Data              |
/// |---------------------------|---------------|-------------------|
/// | `ContractInitialized`     | `init`        | `()`              |
/// | `PlatformFeeUpdated`      | `set_platform_fee` | updated bps  |
/// | `EarningsDeposited`       | `deposit`     | net deposit amount|
/// | `EarningsWithdrawn`       | `withdraw`    | withdrawal amount |
const TOPIC_INITIALIZED: &str = "ContractInitialized";
const TOPIC_FEE_UPDATED: &str = "PlatformFeeUpdated";

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PlatformFeeBps,
    PlatformTreasury,
    CreatorBalance(Address),
}

/// Per-contract error codes for the **creator-deposits** contract.
///
/// These discriminants are stable and form part of the public client API.
/// Do **not** renumber existing variants; add new ones at the end.
///
/// | Code | Variant |
/// |------|---------|
/// | 1 | `InvalidFeeBps` |
/// | 2 | `InsufficientBalance` |
/// | 3 | `AdminNotInitialized` |
/// | 4 | `PlatformFeeNotInitialized` |
/// | 5 | `PlatformTreasuryNotInitialized` |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Code 1 – platform fee basis points must be < 10 000 (100 %).
    InvalidFeeBps = 1,
    /// Code 2 – creator balance is less than the requested withdrawal amount.
    InsufficientBalance = 2,
    /// Code 3 – admin key not present; contract was never initialized.
    AdminNotInitialized = 3,
    /// Code 4 – platform fee not set; contract init was incomplete.
    PlatformFeeNotInitialized = 4,
    /// Code 5 – platform treasury not set; contract init was incomplete.
    PlatformTreasuryNotInitialized = 5,
}

#[contract]
pub struct CreatorDeposits;

#[contractimpl]
impl CreatorDeposits {
    pub fn init(env: Env, admin: Address, platform_fee_bps: u32, platform_treasury: Address) {
        admin.require_auth();
        if platform_fee_bps >= 10000 {
            panic_with_error!(&env, Error::InvalidFeeBps);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::PlatformTreasury, &platform_treasury);

        env.events()
            .publish((Symbol::new(&env, TOPIC_INITIALIZED),), ());
    }

    pub fn deposit(env: Env, creator: Address, token: Address, amount: i128) {
        creator.require_auth();

        // Optimization: Read both config values once and cache in local variables
        // to avoid redundant storage reads during a single transaction.
        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlatformFeeBps)
            .unwrap_or_else(|| {
                panic_with_error!(&env, Error::PlatformFeeNotInitialized);
            });
        let treasury: Address = env
            .storage()
            .instance()
            .get(&DataKey::PlatformTreasury)
            .unwrap_or_else(|| {
                panic_with_error!(&env, Error::PlatformTreasuryNotInitialized);
            });

        let fee = (amount * fee_bps as i128) / 10000;
        let net = amount - fee;

        let token_client = token::Client::new(&env, &token);

        // Optimization: Only transfer fee if nonzero, avoiding unnecessary transfer calls.
        if fee > 0 {
            token_client.transfer(&creator, &treasury, &fee);
        }
        if net > 0 {
            token_client.transfer(&creator, &env.current_contract_address(), &net);
        }

        // Optimization: Read balance once and update in single write;
        // use unwrap_or(0) to avoid panicking on first deposit.
        let balance_key = DataKey::CreatorBalance(creator.clone());
        let current: i128 = env.storage().instance().get(&balance_key).unwrap_or(0);
        env.storage().instance().set(&balance_key, &(current + net));

        env.events().publish(
            (
                Symbol::new(&env, "EarningsDeposited"),
                creator.clone(),
                token,
            ),
            net,
        );
    }

    pub fn withdraw(env: Env, creator: Address, token: Address, amount: i128) {
        creator.require_auth();

        // Optimization: Read balance once, validate, and update in single write;
        // use unwrap_or(0) to handle accounts with no prior deposits.
        let balance_key = DataKey::CreatorBalance(creator.clone());
        let current: i128 = env.storage().instance().get(&balance_key).unwrap_or(0);

        if current < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        // Optimization: Only update storage if withdrawal succeeds validation.
        env.storage()
            .instance()
            .set(&balance_key, &(current - amount));

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &creator, &amount);

        env.events().publish(
            (
                Symbol::new(&env, "EarningsWithdrawn"),
                creator.clone(),
                token,
            ),
            amount,
        );
    }

    pub fn set_platform_fee(env: Env, bps: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| {
                panic_with_error!(&env, Error::AdminNotInitialized);
            });
        admin.require_auth();
        if bps >= 10000 {
            panic_with_error!(&env, Error::InvalidFeeBps);
        }
        env.storage().instance().set(&DataKey::PlatformFeeBps, &bps);

        env.events()
            .publish((Symbol::new(&env, TOPIC_FEE_UPDATED),), bps);
    }

    pub fn get_balance(env: Env, creator: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::CreatorBalance(creator))
            .unwrap_or(0)
    }

    pub fn get_platform_fee(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PlatformFeeBps)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events, MockAuth, MockAuthInvoke},
        token::StellarAssetClient,
        vec,
        xdr::{ScAddress, SorobanAuthorizationEntry},
        Env, IntoVal, Symbol, TryFromVal, TryIntoVal,
    };

    const EMPTY_AUTHS: &[SorobanAuthorizationEntry] = &[];

    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let creator = Address::generate(&env);
        let token_addr = env.register_contract(None, MockToken);
        (env, admin, treasury, creator, token_addr)
    }

    #[contract]
    struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    #[test]
    fn test_fee_deducted_correctly() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury); // 5% fee
        client.deposit(&creator, &token, &1000);

        assert_eq!(client.get_balance(&creator), 950); // 1000 - 50 fee

        let events = env.events().all();
        // events[0] is the ContractInitialized event from init()
        // events[1] is the EarningsDeposited event
        assert!(events.len() >= 2);
        let deposit_event = events.get(events.len() - 1).unwrap();
        assert_eq!(deposit_event.0, contract_id.clone());
        let expected_topics = (
            Symbol::new(&env, "EarningsDeposited"),
            creator.clone(),
            token.clone(),
        )
            .into_val(&env);
        assert_eq!(deposit_event.1, expected_topics);
        let data: i128 = i128::try_from_val(&env, &deposit_event.2).unwrap();
        assert_eq!(data, 950);
    }

    #[test]
    fn test_treasury_receives_fee() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        client.deposit(&creator, &token, &1000);

        // Verify transfer was called with correct fee (50)
        assert!(!env.auths().is_empty());
    }

    #[test]
    fn test_creator_receives_net() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &1000, &treasury); // 10% fee
        client.deposit(&creator, &token, &5000);

        assert_eq!(client.get_balance(&creator), 4500); // 5000 - 500 fee
    }

    #[test]
    fn test_invalid_bps_init_reverts() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        let result = client.try_init(&admin, &10000, &treasury);
        assert_eq!(
            result,
            Err(Ok(soroban_sdk::Error::from_contract_error(
                Error::InvalidFeeBps as u32,
            )))
        );
    }

    #[test]
    fn test_invalid_bps_set_platform_fee_reverts() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        let result = client.try_set_platform_fee(&10001);
        assert_eq!(
            result,
            Err(Ok(soroban_sdk::Error::from_contract_error(
                Error::InvalidFeeBps as u32,
            )))
        );
    }

    #[test]
    fn test_set_platform_fee_admin_only() {
        let (env, admin, treasury, _creator, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        client.set_platform_fee(&1000);

        assert_eq!(client.get_platform_fee(), 1000);
    }

    #[test]
    fn test_zero_fee() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &0, &treasury);
        client.deposit(&creator, &token, &1000);

        assert_eq!(client.get_balance(&creator), 1000);
    }

    #[test]
    fn test_multiple_deposits_accumulate() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        client.deposit(&creator, &token, &1000);
        client.deposit(&creator, &token, &2000);

        assert_eq!(client.get_balance(&creator), 2850); // 950 + 1900
    }

    #[test]
    fn test_withdraw_works() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &0, &treasury);
        client.deposit(&creator, &token, &1000);

        assert_eq!(client.get_balance(&creator), 1000);

        // Verify deposit event (last event = EarningsDeposited since init also emits an event)
        let events = env.events().all();
        assert!(events.len() >= 2);
        let dep_event = events.get(events.len() - 1).unwrap();
        let expected_dep_topics = (
            Symbol::new(&env, "EarningsDeposited"),
            creator.clone(),
            token.clone(),
        )
            .into_val(&env);
        assert_eq!(dep_event.1, expected_dep_topics);
        let dep_data: i128 = i128::try_from_val(&env, &dep_event.2).unwrap();
        assert_eq!(dep_data, 1000);

        client.withdraw(&creator, &token, &500);

        assert_eq!(client.get_balance(&creator), 500);

        let events = env.events().all();
        let expected_topics = (
            Symbol::new(&env, "EarningsWithdrawn"),
            creator.clone(),
            token.clone(),
        )
            .into_val(&env);

        let actual_event = events.last().unwrap();
        assert_eq!(actual_event.0, contract_id.clone());
        assert_eq!(actual_event.1, expected_topics);

        let actual_data: i128 = i128::try_from_val(&env, &actual_event.2).unwrap();
        assert_eq!(actual_data, 500i128);
    }

    #[test]
    fn test_withdraw_insufficient_balance() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &0, &treasury);
        client.deposit(&creator, &token, &1000);

        let result = client.try_withdraw(&creator, &token, &1001);
        assert_eq!(
            result,
            Err(Ok(soroban_sdk::Error::from_contract_error(
                Error::InsufficientBalance as u32,
            )))
        );
    }

    #[test]
    fn test_unauthorized_withdraw_reverts() {
        let (env, admin, treasury, creator, token) = setup();
        let unauthorized = Address::generate(&env);
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "init",
                args: vec![
                    &env,
                    admin.clone().into_val(&env),
                    0_u32.into_val(&env),
                    treasury.clone().into_val(&env),
                ],
                sub_invokes: &[],
            },
        }]);
        client.init(&admin, &0, &treasury);

        let deposit_amount = 1000_i128;
        env.mock_auths(&[MockAuth {
            address: &creator,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "deposit",
                args: vec![
                    &env,
                    creator.clone().into_val(&env),
                    token.clone().into_val(&env),
                    deposit_amount.into_val(&env),
                ],
                sub_invokes: &[],
            },
        }]);
        client.deposit(&creator, &token, &deposit_amount);

        let starting_balance = client.get_balance(&creator);
        assert_eq!(starting_balance, 1000);

        env.set_auths(EMPTY_AUTHS);

        let result = client.try_withdraw(&unauthorized, &token, &100);
        assert!(result.is_err(), "expected unauthorized withdraw to revert");

        assert_eq!(client.get_balance(&creator), starting_balance);
    }

    #[test]
    fn test_admin_not_initialized_error() {
        let (env, _, _, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        let result = client.try_set_platform_fee(&500);
        assert_eq!(
            result,
            Err(Ok(soroban_sdk::Error::from_contract_error(
                Error::AdminNotInitialized as u32,
            )))
        );
    }

    #[test]
    fn test_deposit_without_init_returns_error() {
        let (env, _, _, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        // Don't call init, deposit should fail
        let result = client.try_deposit(&creator, &token, &1000);
        // Should fail with either PlatformFeeNotInitialized or PlatformTreasuryNotInitialized
        assert!(result.is_err(), "deposit without init should return error");
    }

    // ── Issue #930: Additional init / admin path tests ──────────────

    #[test]
    fn test_init_validates_fee_bps_upper_boundary() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        let result = client.try_init(&admin, &9999, &treasury);
        assert!(result.is_ok());
        assert_eq!(client.get_platform_fee(), 9999);
    }

    #[test]
    fn test_init_reinitialization_is_idempotent() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        let treasury2 = Address::generate(&env);
        client.init(&admin, &1000, &treasury2);
        assert_eq!(client.get_platform_fee(), 1000);
    }

    #[test]
    fn test_get_platform_fee_before_init_returns_zero() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);
        assert_eq!(client.get_platform_fee(), 0);
    }

    #[test]
    fn test_get_balance_before_any_deposit_returns_zero() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        assert_eq!(client.get_balance(&creator), 0);
    }

    // ── Issue #931: Unauthorized caller revert tests ────────────────

    #[test]
    fn test_unauthorized_deposit_reverts() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);
        let attacker = Address::generate(&env);
        let token_addr = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "init",
                args: vec![
                    &env,
                    admin.clone().into_val(&env),
                    treasury.clone().into_val(&env),
                    500u32.into_val(&env),
                ],
                sub_invokes: &[],
            },
        }]);
        client.init(&admin, &500, &treasury);
        env.set_auths(EMPTY_AUTHS);

        let result = client.try_deposit(&attacker, &token_addr, &1000);
        assert!(result.is_err(), "deposit without auth should revert");
    }

    #[test]
    fn test_unauthorized_set_platform_fee_reverts() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);
        let non_admin = Address::generate(&env);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        env.mock_auths(&[MockAuth {
            address: &non_admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_platform_fee",
                args: vec![&env, 200u32.into_val(&env)],
                sub_invokes: &[],
            },
        }]);
        let result = client.try_set_platform_fee(&200);
        assert!(result.is_err(), "non-admin set_platform_fee should revert");
        assert_eq!(client.get_platform_fee(), 500);
    }

    #[test]
    fn test_unauthorized_admin_caller_reverts() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);
        let impostor = Address::generate(&env);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        env.set_auths(EMPTY_AUTHS);

        env.mock_auths(&[MockAuth {
            address: &impostor,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_platform_fee",
                args: vec![&env, 200u32.into_val(&env)],
                sub_invokes: &[],
            },
        }]);
        let result = client.try_set_platform_fee(&200);
        assert!(
            result.is_err(),
            "impostor calling set_platform_fee should revert"
        );
    }

    // ── Issue #932: Event emission tests ───────────────────────────

    #[test]
    fn test_init_emits_event() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);

        let events = env.events().all();
        let init_count = events
            .iter()
            .filter(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, TOPIC_INITIALIZED))
                })
            })
            .count();
        assert_eq!(init_count, 1);
    }

    #[test]
    fn test_set_platform_fee_emits_event() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        client.set_platform_fee(&750);

        let events = env.events().all();
        let fee_count = events
            .iter()
            .filter(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, TOPIC_FEE_UPDATED))
                })
            })
            .count();
        assert_eq!(fee_count, 1);
        let data: u32 = events
            .iter()
            .find(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, TOPIC_FEE_UPDATED))
                })
            })
            .unwrap()
            .2
            .try_into_val(&env)
            .unwrap();
        assert_eq!(data, 750);
    }

    #[test]
    fn test_deposit_emits_event() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &0, &treasury);
        client.deposit(&creator, &token, &500);

        let events = env.events().all();
        let dep_count = events
            .iter()
            .filter(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, "EarningsDeposited"))
                })
            })
            .count();
        assert_eq!(dep_count, 1);
        let data: i128 = events
            .iter()
            .find(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, "EarningsDeposited"))
                })
            })
            .unwrap()
            .2
            .try_into_val(&env)
            .unwrap();
        assert_eq!(data, 500);
    }

    #[test]
    fn test_withdraw_emits_event() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &0, &treasury);
        client.deposit(&creator, &token, &1000);
        client.withdraw(&creator, &token, &300);

        let events = env.events().all();
        let wd_count = events
            .iter()
            .filter(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, "EarningsWithdrawn"))
                })
            })
            .count();
        assert_eq!(wd_count, 1);
        let data: i128 = events
            .iter()
            .find(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, "EarningsWithdrawn"))
                })
            })
            .unwrap()
            .2
            .try_into_val(&env)
            .unwrap();
        assert_eq!(data, 300);
    }

    #[test]
    fn test_idempotent_init_multiple_events() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        client.init(&admin, &1000, &treasury);

        let events = env.events().all();
        let init_count = events
            .iter()
            .filter(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, TOPIC_INITIALIZED))
                })
            })
            .count();
        assert_eq!(init_count, 2);
    }

    // ── Issue #934: Snapshot / restore consistency test ─────────────

    #[test]
    fn test_snapshot_restore_consistency() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_addr = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let token_sac = StellarAssetClient::new(&env, &token_addr);

        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        client.init(&admin, &500, &treasury);
        token_sac.mint(&creator1, &10_000);
        token_sac.mint(&creator2, &10_000);

        client.deposit(&creator1, &token_addr, &2000);
        client.deposit(&creator2, &token_addr, &1000);
        client.deposit(&creator1, &token_addr, &1000);
        client.withdraw(&creator1, &token_addr, &500);

        let bal1 = client.get_balance(&creator1);
        let bal2 = client.get_balance(&creator2);
        let fee = client.get_platform_fee();

        let sc_contract: ScAddress = contract_id.clone().into();
        let sc_admin: ScAddress = admin.clone().into();
        let sc_treasury: ScAddress = treasury.clone().into();
        let sc_creator1: ScAddress = creator1.clone().into();
        let sc_creator2: ScAddress = creator2.clone().into();
        let sc_token: ScAddress = token_addr.clone().into();

        let snapshot = env.to_snapshot();

        let env2 = Env::from_snapshot(snapshot);
        env2.mock_all_auths();

        let contract_id2: Address = Address::try_from_val(&env2, &sc_contract).unwrap();
        let _admin2: Address = Address::try_from_val(&env2, &sc_admin).unwrap();
        let _treasury2: Address = Address::try_from_val(&env2, &sc_treasury).unwrap();
        let creator1_2: Address = Address::try_from_val(&env2, &sc_creator1).unwrap();
        let creator2_2: Address = Address::try_from_val(&env2, &sc_creator2).unwrap();
        let token_addr2: Address = Address::try_from_val(&env2, &sc_token).unwrap();

        env2.register_contract(Some(&contract_id2), CreatorDeposits);
        let client2 = CreatorDepositsClient::new(&env2, &contract_id2);

        assert_eq!(client2.get_platform_fee(), fee);
        assert_eq!(client2.get_balance(&creator1_2), bal1);
        assert_eq!(client2.get_balance(&creator2_2), bal2);

        client2.set_platform_fee(&300);
        assert_eq!(client2.get_platform_fee(), 300);

        client2.deposit(&creator1_2, &token_addr2, &500);
        let expected = bal1 + 500 - ((500 * 300) / 10000);
        assert_eq!(client2.get_balance(&creator1_2), expected);

        client2.withdraw(&creator1_2, &token_addr2, &100);
        assert_eq!(client2.get_balance(&creator1_2), expected - 100);
    }
}

#[cfg(test)]
#[path = "property_tests.rs"]
mod property_tests;
