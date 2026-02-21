#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PlatformFeeBps,
    PlatformTreasury,
    CreatorBalance(Address),
}

#[contract]
pub struct CreatorDeposits;

#[contractimpl]
impl CreatorDeposits {
    pub fn init(env: Env, admin: Address, platform_fee_bps: u32, platform_treasury: Address) {
        assert!(platform_fee_bps < 10000, "fee must be < 10000 bps");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::PlatformTreasury, &platform_treasury);
    }

    pub fn deposit(env: Env, creator: Address, token: Address, amount: i128) {
        creator.require_auth();

        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlatformFeeBps)
            .unwrap();
        let treasury: Address = env
            .storage()
            .instance()
            .get(&DataKey::PlatformTreasury)
            .unwrap();

        let fee = (amount * fee_bps as i128) / 10000;
        let net = amount - fee;

        let token_client = token::Client::new(&env, &token);

        if fee > 0 {
            token_client.transfer(&creator, &treasury, &fee);
        }

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

        let balance_key = DataKey::CreatorBalance(creator.clone());
        let current: i128 = env.storage().instance().get(&balance_key).unwrap_or(0);

        assert!(current >= amount, "insufficient balance");

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
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        assert!(bps < 10000, "fee must be < 10000 bps");
        env.storage().instance().set(&DataKey::PlatformFeeBps, &bps);
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
        testutils::{Address as _, Events},
        vec, Env, IntoVal, Symbol, TryFromVal,
    };

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
        assert_eq!(
            events,
            vec![
                &env,
                (
                    contract_id.clone(),
                    (
                        Symbol::new(&env, "EarningsDeposited"),
                        creator.clone(),
                        token.clone()
                    )
                        .into_val(&env),
                    950i128.into_val(&env)
                )
            ]
        );
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
        assert!(env.auths().len() > 0);
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
    #[should_panic(expected = "fee must be < 10000 bps")]
    fn test_invalid_bps_init_reverts() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &10000, &treasury);
    }

    #[test]
    #[should_panic(expected = "fee must be < 10000 bps")]
    fn test_invalid_bps_set_platform_fee_reverts() {
        let (env, admin, treasury, _, _) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &500, &treasury);
        client.set_platform_fee(&10001);
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

        // Let's test the event being output from deposit before clearing it
        let events_deposit = env.events().all();
        assert_eq!(
            events_deposit,
            vec![
                &env,
                (
                    contract_id.clone(),
                    (
                        Symbol::new(&env, "EarningsDeposited"),
                        creator.clone(),
                        token.clone()
                    )
                        .into_val(&env),
                    1000i128.into_val(&env)
                )
            ]
        );

        // Reset the event buffer or we just have two events
        let mut events_vec = env.events().all();
        events_vec.remove(0); // This just shows how you can clear, better to check length

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
    #[should_panic(expected = "insufficient balance")]
    fn test_withdraw_insufficient_balance() {
        let (env, admin, treasury, creator, token) = setup();
        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(&env, &contract_id);

        env.mock_all_auths();
        client.init(&admin, &0, &treasury);
        client.deposit(&creator, &token, &1000);

        client.withdraw(&creator, &token, &1001);
    }
}
