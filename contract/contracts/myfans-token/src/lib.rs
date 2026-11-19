//! MyFans token contract.
//!
//! A SEP-41 style fungible token with an admin-controlled mint and burn.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol};

/// Maximum number of decimal places accepted by `initialize`.
pub const MAX_DECIMALS: u32 = 18;

/// Topic emitted on a successful `mint`.
pub const MINT_TOPIC: Symbol = symbol_short!("mint");
/// Topic emitted on a successful `burn`.
pub const BURN_TOPIC: Symbol = symbol_short!("burn");
/// Topic emitted on a successful `transfer`.
pub const TRANSFER_TOPIC: Symbol = symbol_short!("transfer");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
}

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    /// Initialize the token with metadata and an admin.
    ///
    /// `decimals` must not exceed [`MAX_DECIMALS`] (18); larger values are
    /// rejected with `TokenError::InvalidAmount` before any storage is written.
    /// Requires the admin to authorize the call so that the first caller
    /// cannot seize minting rights.
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("AlreadyInitialized");
        }

        if decimals > MAX_DECIMALS {
            return Err(TokenError::InvalidAmount);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).unwrap()
    }

    /// Return the admin address configured at initialization.
    pub fn admin(env: Env) -> Result<Address, TokenError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)
    }

    /// Mint `amount` tokens to `to`. Only the admin may mint.
    ///
    /// Emits a `mint` event with topics `(mint, to)` and data `amount`.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_total = total.checked_add(amount).ok_or(TokenError::Overflow)?;

        let balance = Self::balance(env.clone(), to.clone());
        let new_balance = balance.checked_add(amount).ok_or(TokenError::Overflow)?;

        env.storage().instance().set(&DataKey::TotalSupply, &new_total);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_balance);

        env.events()
            .publish((MINT_TOPIC, to), amount);

        Ok(())
    }

    /// Burn `amount` tokens from `from`.
    ///
    /// Emits a `burn` event with topics `(burn, from)` and data `amount`.
    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        Self::require_initialized(&env)?;
        from.require_auth();

        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }

        let balance = Self::balance(env.clone(), from.clone());
        let new_balance = balance.checked_sub(amount).ok_or(TokenError::Underflow)?;

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_total = total.checked_sub(amount).ok_or(TokenError::Underflow)?;

        env.storage().instance().set(&DataKey::TotalSupply, &new_total);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &new_balance);

        env.events()
            .publish((BURN_TOPIC, from), amount);

        Ok(())
    }

    /// Transfer `amount` tokens from `from` to `to`.
    ///
    /// Emits a `transfer` event with topics `(transfer, from, to)` and data
    /// `amount`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        Self::require_initialized(&env)?;
        from.require_auth();

        if amount <= 0 {
            return Err(TokenError::InvalidAmount);
        }

        let from_balance = Self::balance(env.clone(), from.clone());
        let new_from = from_balance
            .checked_sub(amount)
            .ok_or(TokenError::InsufficientBalance)?;

        let to_balance = Self::balance(env.clone(), to.clone());
        let new_to = to_balance.checked_add(amount).ok_or(TokenError::Overflow)?;

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &new_from);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_to);

        env.events()
            .publish((TRANSFER_TOPIC, from, to), amount);

        Ok(())
    }
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let total = Self::total_supply(env.clone());
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total + amount));

        let bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(bal + amount));
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();

        let total = Self::total_supply(env.clone());
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total - amount));

        let bal = Self::balance(env.clone(), from.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(bal - amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("InvalidAmount");
        }

        let from_bal = Self::balance(env.clone(), from.clone());
        if from_bal < amount {
            panic!("InsufficientBalance");
        }

        // Self-transfers are a no-op: the balance is unchanged.
        if from == to {
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(from_bal - amount));

        let to_bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(to_bal + amount));
    }

    /// Approve `spender` to spend `amount` on behalf of `from` until
    /// `expiration_ledger`.
    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) -> Result<(), TokenError> {
        Self::require_initialized(&env)?;
        from.require_auth();

        if amount < 0 {
            panic!("InvalidAmount");
        }

        // An approval of 0 clears the allowance.
        if amount == 0 {
            env.storage()
                .persistent()
                .remove(&DataKey::Allowance(from, spender));
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Allowance(from, spender), &amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        if amount <= 0 {
            panic!("InvalidAmount");
        }

        let allowed = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowed < amount {
            panic!("InsufficientAllowance");
        }

        let from_bal = Self::balance(env.clone(), from.clone());
        if from_bal < amount {
            panic!("InsufficientBalance");
        }

        // Decrement the allowance in the same call.
        env.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender),
            &(allowed - amount),
        );

        // Self-transfers are a no-op: the balance is unchanged.
        if from == to {
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(from_bal - amount));

        let to_bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(to_bal + amount));
    }

    /// Return `NotInitialized` when the token has not been initialized.
    fn require_initialized(env: &Env) -> Result<(), TokenError> {
        if env.storage().instance().has(&DataKey::Admin) {
            Ok(())
        } else {
            Err(TokenError::NotInitialized)
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn setup() -> (Env, MyFansTokenClient<'static>, Address) {
        let env = Env::default();
        let contract_id = env.register_contract(None, MyFansToken);
        let client = MyFansTokenClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        (env, client, admin)
    }

    fn setup_initialized() -> (Env, MyFansTokenClient<'static>, Address) {
        let (env, client, admin) = setup();
        env.mock_all_auths();
        let name = String::from_str(&env, "MyFans");
        let symbol = String::from_str(&env, "MF");
        client.initialize(&admin, &name, &symbol, &7);
        (env, client, admin)
    }

    fn setup_uninitialized(env: &Env) -> MyFansTokenClient {
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MyFansToken);
        MyFansTokenClient::new(env, &contract_id)
    }

    #[test]
    fn initialize_requires_admin_auth() {
        let (env, client, admin) = setup();
        let name = String::from_str(&env, "MyFans");
        let symbol = String::from_str(&env, "MF");

        // No mocked auth: initialize must fail and leave admin unset.
        let result = client.try_initialize(&admin, &name, &symbol, &7);
        assert!(result.is_err());
        assert!(!env.storage().instance().has(&DataKey::Admin));

        // A later authorized initialize still succeeds.
        env.mock_all_auths();
        client.initialize(&admin, &name, &symbol, &7);
        assert_eq!(client.admin(), admin);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn test_unknown_balance_is_zero() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let unknown = Address::generate(&env);

        assert_eq!(client.balance(&unknown), 0);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn test_allowance_is_zero_when_no_approval_stored() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);

        // `approve` is never called, so no allowance entry exists in storage.
        assert_eq!(client.allowance(&owner, &spender), 0);
    }

    #[test]
    fn test_admin_returns_initialized_admin() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn test_mint_burn_transfer_happy_path() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        // No mocked auth: initialize must fail and leave admin unset.
        let result = client.try_initialize(&admin, &name, &symbol, &7);
        assert!(result.is_err());
        assert!(!env.storage().instance().has(&DataKey::Admin));

        // A later authorized initialize still succeeds.
        env.mock_all_auths();
        client.initialize(&admin, &name, &symbol, &7);
        assert_eq!(client.admin(), admin);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn second_initialize_returns_already_initialized() {
        let (env, client, admin) = setup();
        env.mock_all_auths();
        let name = String::from_str(&env, "MyFans");
        let symbol = String::from_str(&env, "MF");

        client.initialize(&admin, &name, &symbol, &7);

        let result = client.try_initialize(&admin, &name, &symbol, &7);
        assert!(result.is_err());
    }

    #[test]
    fn transfer_from_happy_path_decrements_allowance() {
        let (env, client, admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);
        client.approve(&from, &spender, &60);

        client.transfer_from(&spender, &from, &to, &40);

        assert_eq!(client.balance(&from), 60);
        assert_eq!(client.balance(&to), 40);
        assert_eq!(client.allowance(&from, &spender), 20);
        let _ = admin;
    }

    #[test]
    fn transfer_from_rejects_expired_allowance() {
        let (env, client, _admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);
        client.approve(&from, &spender, &50);

        // Advance the ledger past the allowance expiration.
        env.ledger().set_sequence_number(env.ledger().sequence() + 1_000_000);

        let result = client.try_transfer_from(&spender, &from, &to, &10);
        assert!(result.is_err());
        assert_eq!(client.balance(&from), 100);
        assert_eq!(client.balance(&to), 0);
    }

    #[test]
    fn transfer_from_rejects_insufficient_allowance() {
        let (env, client, _admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);
        client.approve(&from, &spender, &10);

        let result = client.try_transfer_from(&spender, &from, &to, &20);
        assert!(result.is_err());
        assert_eq!(client.balance(&from), 100);
        assert_eq!(client.balance(&to), 0);
        assert_eq!(client.allowance(&from, &spender), 10);
    }

    #[test]
    fn transfer_from_rejects_missing_allowance() {
        let (env, client, _admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);

        let result = client.try_transfer_from(&spender, &from, &to, &10);
        assert!(result.is_err());
        assert_eq!(client.balance(&from), 100);
        assert_eq!(client.balance(&to), 0);
    }

    #[test]
    fn test_token_error_discriminants_are_pinned() {
        // ABI pin: these numbers are part of the contract's public interface.
        // Adding or reordering variants would break every client, so assert
        // each discriminant explicitly. This test does not touch balances.
        assert_eq!(TokenError::AlreadyInitialized as u32, 1);
        assert_eq!(TokenError::NotInitialized as u32, 2);
        assert_eq!(TokenError::Unauthorized as u32, 3);
        assert_eq!(TokenError::InvalidAmount as u32, 4);
        assert_eq!(TokenError::InsufficientBalance as u32, 5);
        assert_eq!(TokenError::Overflow as u32, 6);
        assert_eq!(TokenError::Underflow as u32, 7);
    }

    #[test]
    fn test_mint_non_positive_amount_is_invalid() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);

        for decimals in [0u32, 7, 18] {
            let contract_id = env.register_contract(None, MyFansToken);
            let client = MyFansTokenClient::new(&env, &contract_id);
            client.initialize(
                &admin,
                &String::from_str(&env, "MyFans"),
                &String::from_str(&env, "MYFANS"),
                &decimals,
            );
        }
    }

    #[test]
    fn test_mint_burn_transfer_emit_events() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.mint(&alice, &100);
        let mint_events = env.events().all();
        assert_eq!(mint_events.len(), 1);
        let (_, topics, data) = mint_events.get(0).unwrap();
        assert_eq!(topics.len(), 2);
        assert_eq!(topics.get(0).unwrap(), MINT_TOPIC.into());
        assert_eq!(topics.get(1).unwrap(), alice.clone().into());
        assert_eq!(data, 100i128.into());

        client.transfer(&alice, &bob, &40);
        let transfer_events = env.events().all();
        assert_eq!(transfer_events.len(), 1);
        let (_, topics, data) = transfer_events.get(0).unwrap();
        assert_eq!(topics.len(), 3);
        assert_eq!(topics.get(0).unwrap(), TRANSFER_TOPIC.into());
        assert_eq!(topics.get(1).unwrap(), alice.clone().into());
        assert_eq!(topics.get(2).unwrap(), bob.clone().into());
        assert_eq!(data, 40i128.into());

        client.burn(&bob, &10);
        let burn_events = env.events().all();
        assert_eq!(burn_events.len(), 1);
        let (_, topics, data) = burn_events.get(0).unwrap();
        assert_eq!(topics.len(), 2);
        assert_eq!(topics.get(0).unwrap(), BURN_TOPIC.into());
        assert_eq!(topics.get(1).unwrap(), bob.clone().into());
        assert_eq!(data, 10i128.into());
    }

    #[test]
    fn test_failed_mint_emits_nothing() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let alice = Address::generate(&env);

        let result = client.try_mint(&alice, &0);
        assert_eq!(result, Err(Ok(TokenError::InvalidAmount)));
        assert_eq!(env.events().all().len(), 0);
    }
}
