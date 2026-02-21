#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

#[contracttype]
pub struct Plan {
    pub creator: Address,
    pub asset: Address,
    pub amount: i128,
    pub interval_days: u32,
}

#[contracttype]
pub struct Subscription {
    pub fan: Address,
    pub plan_id: u32,
    pub expiry: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    FeeBps,
    FeeRecipient,
    PlanCount,
    Plan(u32),
    Sub(Address, Address),
    AcceptedToken(Address),
}

#[contract]
pub struct MyfansContract;

#[contractimpl]
impl MyfansContract {
    pub fn init(env: Env, admin: Address, fee_bps: u32, fee_recipient: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::PlanCount, &0u32);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn set_accepted_token(env: Env, token: Address, price: i128) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::AcceptedToken(token), &price);
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
    }

    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval_days: u32,
    ) -> u32 {
        creator.require_auth();
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlanCount)
            .unwrap_or(0);
        let plan_id = count + 1;
        let plan = Plan {
            creator: creator.clone(),
            asset,
            amount,
            interval_days,
        };
        env.storage().instance().set(&DataKey::Plan(plan_id), &plan);
        env.storage().instance().set(&DataKey::PlanCount, &plan_id);
        env.events()
            .publish((Symbol::new(&env, "plan_created"), plan_id), creator);
        plan_id
    }

    pub fn subscribe(env: Env, fan: Address, plan_id: u32, token: Address) {
        fan.require_auth();
        let plan: Plan = env
            .storage()
            .instance()
            .get(&DataKey::Plan(plan_id))
            .unwrap();

        // Validate token and get associated price (or use plan.amount if token matches plan.asset)
        let amount = if token == plan.asset {
            plan.amount
        } else {
            env.storage()
                .instance()
                .get::<DataKey, i128>(&DataKey::AcceptedToken(token.clone()))
                .expect("token not accepted")
        };

        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let fee_recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .unwrap();

        let fee = (amount * fee_bps as i128) / 10000;
        let creator_amount = amount - fee;

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&fan, &plan.creator, &creator_amount);
        if fee > 0 {
            token_client.transfer(&fan, &fee_recipient, &fee);
        }

        let expiry = env.ledger().timestamp() + (plan.interval_days as u64 * 86400);
        let sub = Subscription {
            fan: fan.clone(),
            plan_id,
            expiry,
        };
        env.storage()
            .instance()
            .set(&DataKey::Sub(fan.clone(), plan.creator.clone()), &sub);
        env.events()
            .publish((Symbol::new(&env, "subscribed"), plan_id), fan);
    }

    pub fn is_subscriber(env: Env, fan: Address, creator: Address) -> bool {
        if let Some(sub) = env
            .storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan, creator))
        {
            sub.expiry > env.ledger().timestamp()
        } else {
            false
        }
    }

    pub fn cancel(env: Env, fan: Address, creator: Address) {
        fan.require_auth();
        env.storage()
            .instance()
            .remove(&DataKey::Sub(fan.clone(), creator));
        env.events().publish((Symbol::new(&env, "cancelled"),), fan);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    fn setup_test<'a>() -> (
        Env,
        Address,
        MyfansContractClient<'a>,
        Address,
        Address,
        Address,
        Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let creator = Address::generate(&env);
        let fan = Address::generate(&env);

        let token_id = env.register_contract(None, MockToken);
        let asset = token_id;

        let contract_id = env.register_contract(None, MyfansContract);
        let client = MyfansContractClient::new(&env, &contract_id);

        (env, admin, client, fee_recipient, creator, fan, asset)
    }

    #[test]
    fn test_init() {
        let (env, admin, client, fee_recipient, _, _, _) = setup_test();
        client.init(&admin, &100, &fee_recipient);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_init_fails_if_already_initialized() {
        let (env, admin, client, fee_recipient, _, _, _) = setup_test();
        client.init(&admin, &100, &fee_recipient);
        client.init(&admin, &100, &fee_recipient);
    }

    #[test]
    fn test_subscribe_with_plan_asset() {
        let (env, admin, client, fee_recipient, creator, fan, asset) = setup_test();
        client.init(&admin, &100, &fee_recipient);

        let plan_id = client.create_plan(&creator, &asset, &1000, &30);

        // Subscribe using the plan's default asset
        client.subscribe(&fan, &plan_id, &asset);

        assert!(client.is_subscriber(&fan, &creator));
    }

    #[test]
    fn test_subscribe_with_alt_token() {
        let (env, admin, client, fee_recipient, creator, fan, asset) = setup_test();
        client.init(&admin, &100, &fee_recipient);

        let plan_id = client.create_plan(&creator, &asset, &1000, &30);

        // Register another mock token for alt_token
        let alt_token = env.register_contract(None, MockToken);
        client.set_accepted_token(&alt_token, &500); // 500 units of alt_token for this sub

        // Subscribe using the alt token
        client.subscribe(&fan, &plan_id, &alt_token);

        assert!(client.is_subscriber(&fan, &creator));
    }

    #[test]
    #[should_panic(expected = "token not accepted")]
    fn test_subscribe_with_unaccepted_token_fails() {
        let (env, admin, client, fee_recipient, creator, fan, asset) = setup_test();
        client.init(&admin, &100, &fee_recipient);

        let plan_id = client.create_plan(&creator, &asset, &1000, &30);

        let unaccepted_token = env.register_contract(None, MockToken);
        client.subscribe(&fan, &plan_id, &unaccepted_token);
    }

    #[test]
    fn test_set_admin_works() {
        let (env, admin, client, fee_recipient, _, _, _) = setup_test();
        client.init(&admin, &100, &fee_recipient);

        let new_admin = Address::generate(&env);
        client.set_admin(&new_admin);
    }
}
