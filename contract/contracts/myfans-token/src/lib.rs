//! MyFans token contract.
//!
//! A minimal SEP-41-style fungible token used as the asset for subscription
//! plans. Amounts are `i128`; arithmetic is checked so that overflow/underflow
//! surface as typed errors instead of panics.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String};

/// Storage keys for the token contract.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
}

/// Errors returned by the token contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InsufficientBalance = 5,
    Overflow = 6,
    Underflow = 7,
}

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    /// Initialize the token with metadata and an admin.
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TokenError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        Ok(())
    }

    /// Mint `amount` tokens to `to`. Only the admin may mint.
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
            .set(&DataKey::Balance(to), &new_balance);

        Ok(())
    }

    /// Burn `amount` tokens from `from`.
    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
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
            .set(&DataKey::Balance(from), &new_balance);

        Ok(())
    }

    /// Transfer `amount` tokens from `from` to `to`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
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
            .set(&DataKey::Balance(from), &new_from);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &new_to);

        Ok(())
    }

    /// Return the balance of `account`.
    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account))
            .unwrap_or(0)
    }

    /// Return the total supply of tokens.
    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
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
        from.require_auth();

        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }

        env.storage().persistent().set(
            &DataKey::Allowance(from, spender),
            &(amount, expiration_ledger),
        );

        Ok(())
    }

    /// Return the remaining allowance for `spender` on behalf of `from`.
    ///
    /// Returns 0 once the allowance has expired.
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let stored: Option<(i128, u32)> = env
            .storage()
            .persistent()
            .get(&DataKey::Allowance(from, spender));

        match stored {
            Some((amount, expiration_ledger)) => {
                if expiration_ledger < env.ledger().sequence() {
                    0
                } else {
                    amount
                }
            }
            None => 0,
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{Address, Env, String};

    fn setup(env: &Env) -> (MyFansTokenClient, Address) {
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MyFansToken);
        let client = MyFansTokenClient::new(env, &contract_id);
        let admin = Address::generate(env);
        client.initialize(
            &admin,
            &String::from_str(env, "MyFans"),
            &String::from_str(env, "MYFANS"),
            &7,
        );
        (client, admin)
    }

    #[test]
    fn test_mint_burn_transfer_happy_path() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.mint(&alice, &1000);
        assert_eq!(client.balance(&alice), 1000);
        assert_eq!(client.total_supply(), 1000);

        client.transfer(&alice, &bob, &400);
        assert_eq!(client.balance(&alice), 600);
        assert_eq!(client.balance(&bob), 400);
        assert_eq!(client.total_supply(), 1000);

        client.burn(&alice, &100);
        assert_eq!(client.balance(&alice), 500);
        assert_eq!(client.total_supply(), 900);
    }

    #[test]
    fn test_mint_non_positive_amount_is_invalid() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let alice = Address::generate(&env);

        assert_eq!(client.try_mint(&alice, &0), Err(Ok(TokenError::InvalidAmount)));
        assert_eq!(client.try_mint(&alice, &-5), Err(Ok(TokenError::InvalidAmount)));

        assert_eq!(client.balance(&alice), 0);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn test_transfer_above_balance_is_insufficient() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.mint(&alice, &100);

        assert_eq!(
            client.try_transfer(&alice, &bob, &101),
            Err(Ok(TokenError::InsufficientBalance))
        );

        assert_eq!(client.balance(&alice), 100);
        assert_eq!(client.balance(&bob), 0);
    }

    #[test]
    fn test_allowance_expiry_boundary() {
        let env = Env::default();
        let (client, _admin) = setup(&env);
        let alice = Address::generate(&env);
        let spender = Address::generate(&env);

        let expiry = env.ledger().sequence();
        client.approve(&alice, &spender, &500, &expiry);

        // At the expiry ledger the allowance is still spendable.
        assert_eq!(client.allowance(&alice, &spender), 500);

        // One ledger past the expiry it is no longer spendable.
        env.ledger().set_sequence_number(expiry + 1);
        assert_eq!(client.allowance(&alice, &spender), 0);
    }
}
