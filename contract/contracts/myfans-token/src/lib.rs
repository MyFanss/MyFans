#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InsufficientBalance = 1,
    InsufficientAllowance = 2,
    AllowanceExpired = 3,
    NoAllowance = 4,
    InvalidAmount = 5,
    InvalidExpiration = 6,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Balance(Address),
    Allowance(AllowanceValueKey),
}

#[contracttype]
#[derive(Clone)]
struct AllowanceValueKey {
    from: Address,
    spender: Address,
}

#[contracttype]
#[derive(Clone)]
struct AllowanceData {
    amount: i128,
    expiration_ledger: u32,
}

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    pub fn version(_env: Env) -> u32 {
        1
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, id)
    }

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
        
        env.events().publish(
            (symbol_short!("transfer"), from, to),
            amount,
        );
        Ok(())
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
        
        env.events().publish(
            (symbol_short!("approve"), from, spender),
            amount,
        );
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
        
        env.events().publish(
            (symbol_short!("transfer"), from, to),
            amount,
        );
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
        
        env.events().publish(
            (symbol_short!("mint"), to),
            amount,
        );
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
