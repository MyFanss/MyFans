#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

/// Storage keys for the token contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
}

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    /// Initialize the token contract with admin and initial supply
    ///
    /// # Arguments
    /// * `admin` - Admin address who can manage the token
    /// * `name` - Token name (e.g., "MyFans Token")
    /// * `symbol` - Token symbol (e.g., "MFAN")
    /// * `decimals` - Token decimals (typically 7 for Soroban)
    /// * `initial_supply` - Initial supply (deferred minting to Issue 3)
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
        initial_supply: i128,
    ) {
        // Store admin in persistent storage
        env.storage().instance().set(&DataKey::Admin, &admin);

        // Store token metadata
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &initial_supply);

        // Note: Actual minting is deferred to Issue 3
    }

    /// Get the admin address (view function)
    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not initialized")
    }

    /// Set a new admin address (admin only)
    ///
    /// Requires the caller to be the current admin via auth
    pub fn set_admin(env: Env, new_admin: Address) {
        // Get current admin from storage
        let current_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not initialized");

        // Require authorization from the current admin
        current_admin.require_auth();

        // Update admin in storage
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Get the token name (view function)
    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .expect("token not initialized")
    }

    /// Get the token symbol (view function)
    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .expect("token not initialized")
    }

    /// Get the token decimals (view function)
    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .expect("token not initialized")
    }

    /// Get the total supply (view function)
    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) -> Result<(), Error> {
        from.require_auth();
        if amount < 0 {
            return Err(Error::InvalidAmount);
        }
        if expiration_ledger < env.ledger().sequence() {
            return Err(Error::InvalidExpiration);
        }

        let key = DataKey::Allowance(AllowanceValueKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let data = AllowanceData {
            amount,
            expiration_ledger,
        };

        env.storage().temporary().set(&key, &data);

        env.events()
            .publish((symbol_short!("approve"), from, spender), amount);
        Ok(())
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), Error> {
        spender.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Allowance(AllowanceValueKey {
            from: from.clone(),
            spender: spender.clone(),
        });

        let allowance_data: Option<AllowanceData> = env.storage().temporary().get(&key);

        match allowance_data {
            Some(data) => {
                if data.expiration_ledger < env.ledger().sequence() {
                    return Err(Error::AllowanceExpired);
                }
                if data.amount < amount {
                    return Err(Error::InsufficientAllowance);
                }

                // Update allowance
                let new_allowance = AllowanceData {
                    amount: data.amount - amount,
                    expiration_ledger: data.expiration_ledger,
                };
                env.storage().temporary().set(&key, &new_allowance);
            }
            None => return Err(Error::NoAllowance),
        }

        let balance_from = read_balance(&env, from.clone());
        if balance_from < amount {
            return Err(Error::InsufficientBalance);
        }

        write_balance(&env, from.clone(), balance_from - amount);
        let balance_to = read_balance(&env, to.clone());
        write_balance(&env, to.clone(), balance_to + amount);

        env.events()
            .publish((symbol_short!("transfer"), from, to), amount);
        Ok(())
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(AllowanceValueKey { from, spender });
        let data: Option<AllowanceData> = env.storage().temporary().get(&key);
        match data {
            Some(d) if d.expiration_ledger >= env.ledger().sequence() => d.amount,
            _ => 0,
        }
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let balance = read_balance(&env, to.clone());
        write_balance(&env, to.clone(), balance + amount);

        env.events().publish((symbol_short!("mint"), to), amount);
    }
}

fn read_balance(env: &Env, id: Address) -> i128 {
    let key = DataKey::Balance(id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

fn write_balance(env: &Env, id: Address, amount: i128) {
    let key = DataKey::Balance(id);
    env.storage().persistent().set(&key, &amount);
}

#[cfg(test)]
mod test;
