#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Overflow = 4,
    Underflow = 5,
    InsufficientBalance = 6,
    InvalidAmount = 7,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct TokenState {
    pub admin: Address,
    pub total_supply: i128,
    pub metadata: TokenMetadata,
}

const STATE_KEY: &str = "STATE";
const BALANCE_KEY: &str = "BALANCE";
const ALLOWANCE_KEY: &str = "ALLOWANCE";

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&STATE_KEY) {
            return Err(TokenError::AlreadyInitialized);
        }
        let state = TokenState {
            admin,
            total_supply: 0,
            metadata: TokenMetadata {
                name,
                symbol,
                decimals,
            },
        };
        env.storage().instance().set(&STATE_KEY, &state);
        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, TokenError> {
        Ok(Self::state(&env)?.admin)
    }

    pub fn total_supply(env: Env) -> Result<i128, TokenError> {
        Ok(Self::state(&env)?.total_supply)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&(BALANCE_KEY, id))
            .unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = (ALLOWANCE_KEY, from, spender);
        let value: Option<AllowanceValue> = env.storage().persistent().get(&key);
        match value {
            Some(allowance) if allowance.expiration_ledger >= env.ledger().sequence() => {
                allowance.amount
            }
            _ => 0,
        }
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        let mut state = Self::state(&env)?;
        state.admin.require_auth();

        let new_supply = state
            .total_supply
            .checked_add(amount)
            .ok_or(TokenError::Overflow)?;

        let balance = Self::balance(env.clone(), to.clone());
        let new_balance = balance
            .checked_add(amount)
            .ok_or(TokenError::Overflow)?;

        env.storage()
            .persistent()
            .set(&(BALANCE_KEY, to), &new_balance);
        state.total_supply = new_supply;
        env.storage().instance().set(&STATE_KEY, &state);
        Ok(())
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        from.require_auth();

        let mut state = Self::state(&env)?;
        let balance = Self::balance(env.clone(), from.clone());
        if balance < amount {
            return Err(TokenError::InsufficientBalance);
        }

        let new_balance = balance
            .checked_sub(amount)
            .ok_or(TokenError::Underflow)?;
        let new_supply = state
            .total_supply
            .checked_sub(amount)
            .ok_or(TokenError::Underflow)?;

        env.storage()
            .persistent()
            .set(&(BALANCE_KEY, from), &new_balance);
        state.total_supply = new_supply;
        env.storage().instance().set(&STATE_KEY, &state);
        Ok(())
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        from.require_auth();

        let from_balance = Self::balance(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        let new_from_balance = from_balance
            .checked_sub(amount)
            .ok_or(TokenError::Underflow)?;

        let to_balance = Self::balance(env.clone(), to.clone());
        let new_to_balance = to_balance
            .checked_add(amount)
            .ok_or(TokenError::Overflow)?;

        env.storage()
            .persistent()
            .set(&(BALANCE_KEY, from), &new_from_balance);
        env.storage()
            .persistent()
            .set(&(BALANCE_KEY, to), &new_to_balance);
        Ok(())
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) -> Result<(), TokenError> {
        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }
        from.require_auth();
        let key = (ALLOWANCE_KEY, from, spender);
        let value = AllowanceValue {
            amount,
            expiration_ledger,
        };
        env.storage().persistent().set(&key, &value);
        Ok(())
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }
        spender.require_auth();

        let allowance = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowance < amount {
            return Err(TokenError::InsufficientBalance);
        }

        let from_balance = Self::balance(env.clone(), from.clone());
        if from_balance < amount {
            return Err(TokenError::InsufficientBalance);
        }
        let new_from_balance = from_balance
            .checked_sub(amount)
            .ok_or(TokenError::Underflow)?;

        let to_balance = Self::balance(env.clone(), to.clone());
        let new_to_balance = to_balance
            .checked_add(amount)
            .ok_or(TokenError::Overflow)?;

        let new_allowance = allowance
            .checked_sub(amount)
            .ok_or(TokenError::Underflow)?;
        let key = (ALLOWANCE_KEY, from.clone(), spender);
        let value = AllowanceValue {
            amount: new_allowance,
            expiration_ledger: env.ledger().sequence(),
        };
        env.storage().persistent().set(&key, &value);

        env.storage()
            .persistent()
            .set(&(BALANCE_KEY, from), &new_from_balance);
        env.storage()
            .persistent()
            .set(&(BALANCE_KEY, to), &new_to_balance);
        Ok(())
    }

    fn state(env: &Env) -> Result<TokenState, TokenError> {
        env.storage()
            .instance()
            .get(&STATE_KEY)
            .ok_or(TokenError::NotInitialized)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn setup(env: &Env) -> (MyFansTokenClient, Address) {
        let contract_id = env.register_contract(None, MyFansToken);
        let client = MyFansTokenClient::new(env, &contract_id);
        let admin = Address::generate(env);
        client.initialize(
            &admin,
            &String::from_str(env, "MyFans"),
            &String::from_str(env, "MFAN"),
            &7,
        );
        (client, admin)
    }

    #[test]
    fn mint_happy_path_updates_supply_and_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin) = setup(&env);
        let user = Address::generate(&env);

        client.mint(&user, &1_000);
        assert_eq!(client.balance(&user), 1_000);
        assert_eq!(client.total_supply(), 1_000);
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn non_admin_mint_reverts() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let attacker = Address::generate(&env);
        let user = Address::generate(&env);

        // Only the attacker authorizes; admin auth is missing.
        env.mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &attacker,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &client.address,
                fn_name: "mint",
                args: (user.clone(), 1_000_i128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let result = client.try_mint(&user, &1_000);
        assert!(result.is_err());
        assert_eq!(client.total_supply(), 0);
        assert_eq!(client.balance(&user), 0);
    }

    #[test]
    fn mint_overflow_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let user = Address::generate(&env);

        client.mint(&user, &i128::MAX);
        let result = client.try_mint(&user, &1);
        assert_eq!(result, Err(Ok(TokenError::Overflow)));
        assert_eq!(client.total_supply(), i128::MAX);
    }

    #[test]
    fn burn_more_than_balance_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let user = Address::generate(&env);

        client.mint(&user, &100);
        let result = client.try_burn(&user, &101);
        assert_eq!(result, Err(Ok(TokenError::InsufficientBalance)));
        assert_eq!(client.balance(&user), 100);
        assert_eq!(client.total_supply(), 100);
    }

    #[test]
    fn burn_happy_path_decreases_supply() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let user = Address::generate(&env);

        client.mint(&user, &500);
        client.burn(&user, &200);
        assert_eq!(client.balance(&user), 300);
        assert_eq!(client.total_supply(), 300);
    }

    #[test]
    fn transfer_happy_path_preserves_supply() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &1_000);
        client.transfer(&from, &to, &400);
        assert_eq!(client.balance(&from), 600);
        assert_eq!(client.balance(&to), 400);
        assert_eq!(client.total_supply(), 1_000);
    }

    #[test]
    fn transfer_more_than_balance_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);
        let result = client.try_transfer(&from, &to, &101);
        assert_eq!(result, Err(Ok(TokenError::InsufficientBalance)));
        assert_eq!(client.balance(&from), 100);
        assert_eq!(client.balance(&to), 0);
    }

    #[test]
    fn mint_zero_or_negative_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let user = Address::generate(&env);

        assert_eq!(client.try_mint(&user, &0), Err(Ok(TokenError::InvalidAmount)));
        assert_eq!(client.try_mint(&user, &-1), Err(Ok(TokenError::InvalidAmount)));
        assert_eq!(client.total_supply(), 0);
    }
}
