#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String,
};

/// Storage keys for the token contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Allowance(AllowanceValueKey),
}

/// Key for allowance storage (from, spender)
#[contracttype]
#[derive(Clone)]
pub struct AllowanceValueKey {
    pub from: Address,
    pub spender: Address,
}

/// Stored allowance data
#[contracttype]
#[derive(Clone)]
pub struct AllowanceData {
    pub amount: i128,
    pub expiration_ledger: u32,
}

/// Token contract errors (codes 1–7 match test expectations)
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InsufficientBalance = 1,   // transfer: not enough balance
    InsufficientAllowance = 2, // transfer_from: allowance too low
    AllowanceExpired = 3,      // transfer_from: allowance expired
    InvalidAmount = 4,
    InvalidExpiration = 5,
    NoAllowance = 6,
    Unauthorized = 7, // mint: caller is not admin
}

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    /// Temporary allowance entries must stay readable until at least one ledger
    /// after `expiration_ledger`, so `transfer_from` can return [`Error::AllowanceExpired`]
    /// instead of [`Error::NoAllowance`] when the logical allowance has expired.
    fn bump_allowance_temp_ttl(env: &Env, key: &DataKey, expiration_ledger: u32) {
        let seq = env.ledger().sequence();
        // Default temp TTL after `set` is typically 16; threshold must be > that
        // so extend runs, and host requires threshold <= extend_to.
        let extend_to = expiration_ledger
            .saturating_sub(seq)
            .saturating_add(2)
            .max(17)
            .min(env.storage().max_ttl());
        env.storage()
            .temporary()
            .extend_ttl(key, extend_to, extend_to);
    }

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

    /// Update token name and symbol. Only admin can call this.
    /// Decimals remain immutable.
    ///
    /// # Arguments
    /// * `new_name` - New token name
    /// * `new_symbol` - New token symbol
    pub fn set_metadata(env: Env, new_name: String, new_symbol: String) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not initialized");
        admin.require_auth();

        env.storage().instance().set(&DataKey::Name, &new_name);
        env.storage().instance().set(&DataKey::Symbol, &new_symbol);

        env.events()
            .publish((symbol_short!("meta_upd"),), (new_name, new_symbol));
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

        // Store and extend TTL for temporary storage (see bump_allowance_temp_ttl).
        env.storage().temporary().set(&key, &data);
        Self::bump_allowance_temp_ttl(&env, &key, expiration_ledger);

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
                Self::bump_allowance_temp_ttl(&env, &key, data.expiration_ledger);
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

        // Emit transfer_from event so indexers can identify spender-triggered transfers.
        // Regular `transfer` events use topics (transfer, from, to); this uses
        // (transfer_from, spender, from, to) to distinguish the two paths.
        env.events()
            .publish((symbol_short!("xfer_from"), spender, from, to), amount);
        Ok(())
    }

    /// Zero out the allowance for (from, spender). `from` must authorize.
    pub fn clear_allowance(env: Env, from: Address, spender: Address) {
        from.require_auth();
        let key = DataKey::Allowance(AllowanceValueKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let data = AllowanceData {
            amount: 0,
            expiration_ledger: env.ledger().sequence(),
        };
        env.storage().temporary().set(&key, &data);
        Self::bump_allowance_temp_ttl(&env, &key, data.expiration_ledger);
        env.events()
            .publish((symbol_short!("approve"), from, spender), 0i128);
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(AllowanceValueKey { from, spender });
        let data: Option<AllowanceData> = env.storage().temporary().get(&key);
        match data {
            Some(d) if d.expiration_ledger >= env.ledger().sequence() => d.amount,
            _ => 0,
        }
    }

    /// Mint new tokens to `to`. Only the contract admin may call this.
    ///
    /// # Errors
    /// * [`Error::Unauthorized`] – caller is not the stored admin.
    /// * [`Error::InvalidAmount`] – `amount` is zero or negative.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Read admin from storage and require their authorisation.
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not initialized");
        admin.require_auth();

        let balance = read_balance(&env, to.clone());
        write_balance(&env, to.clone(), balance + amount);

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total + amount));

        env.events().publish((symbol_short!("mint"), to), amount);
        Ok(())
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let balance = read_balance(&env, from.clone());
        if balance < amount {
            return Err(Error::InsufficientBalance);
        }

        write_balance(&env, from.clone(), balance - amount);

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total - amount));

        env.events().publish((symbol_short!("burn"), from), amount);
        Ok(())
    }

    /// Get balance for an address (view function)
    pub fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, id)
    }

    /// Transfer tokens from caller to another address. Caller must authorize.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
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
}

fn read_balance(env: &Env, id: Address) -> i128 {
    let key = DataKey::Balance(id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

fn write_balance(env: &Env, id: Address, amount: i128) {
    let key = DataKey::Balance(id);
    env.storage().persistent().set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, 100, 100);
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod allowance_expiry_tests;

#[cfg(test)]
mod property_tests;
