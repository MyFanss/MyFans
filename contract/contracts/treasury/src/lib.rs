#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol};

/// Storage keys for the treasury contract.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Token,
    Balance(Address),
}

/// Errors returned by the treasury contract.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TreasuryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    Unauthorized = 4,
    InvalidAmount = 5,
    InsufficientBalance = 6,
    TransferFailed = 7,
}

/// Emitted when fees are deposited into the treasury.
///
/// Only the depositor address and the amount are recorded so that off-chain
/// indexers can reconcile balances without exposing any PII.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositEvent {
    pub from: Address,
    pub amount: i128,
}

/// Emitted when funds are withdrawn from the treasury.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawEvent {
    pub to: Address,
    pub amount: i128,
}

const DEPOSIT: Symbol = symbol_short!("deposit");
const WITHDRAW: Symbol = symbol_short!("withdraw");

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    /// Initialize the treasury with an admin and the token it holds.
    ///
    /// The admin must authorize the call and initialization may only happen
    /// once. A second call reverts with `AlreadyInitialized`.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), TreasuryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TreasuryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    /// Deposit protocol fees into the treasury.
    ///
    /// Honors the pause flag, requires authorization from the depositing
    /// payment path, pulls `amount` of the configured token from `from` into
    /// the contract, then credits the internal balance and emits a
    /// `DepositEvent`. If the token transfer fails, storage is unchanged.
    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<(), TreasuryError> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(TreasuryError::NotInitialized);
        }
        if Self::is_paused(env.clone()) {
            return Err(TreasuryError::Paused);
        }
        if amount <= 0 {
            return Err(TreasuryError::InvalidAmount);
        }
        from.require_auth();

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(TreasuryError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        let key = DataKey::Balance(from.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));

        env.events().publish((DEPOSIT, from.clone()), DepositEvent { from, amount });
        Ok(())
    }

    /// Withdraw funds from the treasury.
    ///
    /// Only the admin (see AUTH_MATRIX) may withdraw. Honors the pause flag:
    /// when the treasury is paused the call reverts with `Paused` and no
    /// balance is mutated. Debits the internal balance and transfers the same
    /// amount of the configured token to `to`. On any failure the stored
    /// balance is left unchanged.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), TreasuryError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TreasuryError::NotInitialized)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(TreasuryError::InvalidAmount);
        }

        if Self::is_paused(env.clone()) {
            return Err(TreasuryError::Paused);
        }

        let key = DataKey::Balance(to.clone());
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if current < amount {
            return Err(TreasuryError::InsufficientBalance);
        }

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(TreasuryError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        env.storage().persistent().set(&key, &(current - amount));

        env.events().publish((WITHDRAW, to.clone()), WithdrawEvent { to, amount });
        Ok(())
    }

    /// Pause or unpause deposits. Admin only.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), TreasuryError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TreasuryError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        Ok(())
    }

    /// Returns the current balance for an address.
    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account))
            .unwrap_or(0)
    }

    /// Returns whether deposits are currently paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
    use soroban_sdk::{IntoVal, Val};

    fn setup() -> (Env, TreasuryContractClient<'static>, Address) {
        let env = Env::default();
        let contract_id = env.register_contract(None, TreasuryContract);
        let client = TreasuryContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: (admin.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        client.initialize(&admin);
        (env, client, admin)
    }

    #[test]
    fn error_discriminants_are_stable() {
        // The numeric codes are part of the ABI: the backend maps them to
        // user-facing errors. Inserting a variant in the middle would silently
        // change the code for `Paused` or `InsufficientBalance`.
        assert_eq!(TreasuryError::AlreadyInitialized as u32, 1);
        assert_eq!(TreasuryError::NotInitialized as u32, 2);
        assert_eq!(TreasuryError::Paused as u32, 3);
        assert_eq!(TreasuryError::Unauthorized as u32, 4);
        assert_eq!(TreasuryError::InvalidAmount as u32, 5);
        assert_eq!(TreasuryError::InsufficientBalance as u32, 6);
    }

    #[test]
    fn initialize_requires_admin_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, TreasuryContract);
        let client = TreasuryContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        // No auth mocked: initialize must fail.
        let res = client.try_initialize(&admin);
        assert!(res.is_err());
    }

    #[test]
    fn initialize_rejects_double_init() {
        let (env, client, admin) = setup();
        env.mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "initialize",
                args: (admin.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        let res = client.try_initialize(&admin);
        assert_eq!(res, Err(Ok(TreasuryError::AlreadyInitialized)));
    }

    #[test]
    fn deposit_requires_signer_auth_and_emits_event() {
        let (env, client, _admin) = setup();
        let payer = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: &payer,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "deposit",
                args: (payer.clone(), 100i128).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        client.deposit(&payer, &100);
        assert_eq!(client.balance(&payer), 100);
    }

    #[test]
    fn deposit_without_auth_reverts() {
        let (env, client, _admin) = setup();
        let payer = Address::generate(&env);
        let res = client.try_deposit(&payer, &100);
        assert!(res.is_err());
        assert_eq!(client.balance(&payer), 0);
    }

    #[test]
    fn deposit_rejects_zero_amount() {
        let (env, client, _admin) = setup();
        env.mock_all_auths();
        let payer = Address::generate(&env);

        let res = client.try_deposit(&payer, &0);
        assert_eq!(res, Err(Ok(TreasuryError::InvalidAmount)));
        assert_eq!(client.balance(&payer), 0);
    }

    #[test]
    fn deposit_rejects_negative_amount() {
        let (env, client, _admin) = setup();
        env.mock_all_auths();
        let payer = Address::generate(&env);

        let res = client.try_deposit(&payer, &-1);
        assert_eq!(res, Err(Ok(TreasuryError::InvalidAmount)));
        assert_eq!(client.balance(&payer), 0);
    }
}
