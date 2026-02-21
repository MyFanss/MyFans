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

    pub fn subscribe(env: Env, fan: Address, plan_id: u32) {
        fan.require_auth();
        let plan: Plan = env
            .storage()
            .instance()
            .get(&DataKey::Plan(plan_id))
            .unwrap();
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let fee_recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .unwrap();

        let fee = (plan.amount * fee_bps as i128) / 10000;
        let creator_amount = plan.amount - fee;

        let token_client = token::Client::new(&env, &plan.asset);
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

    fn setup_test() -> (Env, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let fee_recipient = Address::generate(&env);

        let contract_id = env.register_contract(None, MyfansContract);

        (env, contract_id, admin, fee_recipient)
    }

    #[test]
    fn test_init() {
        let (env, contract_id, admin, fee_recipient) = setup_test();
        let client = MyfansContractClient::new(&env, &contract_id);

        client.init(&admin, &100, &fee_recipient);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_init_fails_if_already_initialized() {
        let (env, contract_id, admin, fee_recipient) = setup_test();
        let client = MyfansContractClient::new(&env, &contract_id);

        client.init(&admin, &100, &fee_recipient);
        client.init(&admin, &100, &fee_recipient);
    }

    #[test]
    fn test_set_admin_works() {
        let (env, contract_id, admin, fee_recipient) = setup_test();
        let client = MyfansContractClient::new(&env, &contract_id);

        client.init(&admin, &100, &fee_recipient);

        let new_admin = Address::generate(&env);
        client.set_admin(&new_admin);

        // Verify by setting it again
        let admin3 = Address::generate(&env);
        client.set_admin(&admin3);
    }

    #[test]
    #[should_panic]
    fn test_set_admin_fails_if_unauthorized() {
        let env = Env::default();
        let contract_id = env.register_contract(None, MyfansContract);
        let client = MyfansContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        client.init(&admin, &100, &fee_recipient);

        let non_admin = Address::generate(&env);
        // No mock_all_auths here, so it should fail
        client.set_admin(&non_admin);
    }
}
