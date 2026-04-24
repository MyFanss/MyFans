/// Shared Env fixtures for cross-contract integration tests.
///
/// Import with:
/// ```toml
/// [dev-dependencies]
/// myfans-lib = { path = "../myfans-lib", features = ["testutils"] }
/// ```
/// Then in your test file:
/// ```rust
/// use myfans_lib::test_fixtures::TestEnv;
/// ```
///
/// # What this provides
/// - A single `Env` with `mock_all_auths()` and raised TTLs so ledger
///   advancement never archives instance storage.
/// - Pre-generated `admin`, `fee_recipient`, `creator`, and `fan` addresses.
/// - A registered Stellar-asset token contract with the admin as issuer.
/// - Helper methods to register and initialise the subscription, treasury,
///   content-access, and creator-registry contracts in one call each.
/// - `mint(to, amount)` convenience wrapper.
use soroban_sdk::{
    testutils::{Address as _, Ledger as LedgerTrait},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

/// Minimum TTL applied to every entry so ledger advancement in tests never
/// archives instance storage and causes spurious "entry not found" panics.
pub const TEST_TTL: u32 = 10_000_000;

/// Central fixture that every cross-contract integration test should start from.
///
/// ```rust
/// let f = TestEnv::new();
/// f.token_admin.mint(&f.fan, &5_000);
/// ```
pub struct TestEnv {
    pub env: Env,
    pub admin: Address,
    pub fee_recipient: Address,
    pub creator: Address,
    pub fan: Address,
    pub token_address: Address,
    pub token_client: TokenClient<'static>,
    pub token_admin_client: StellarAssetClient<'static>,
}

impl TestEnv {
    /// Build a fully-wired test environment.
    ///
    /// - `mock_all_auths()` is active for the lifetime of the returned `TestEnv`.
    /// - Instance and temporary storage TTLs are raised to [`TEST_TTL`] so
    ///   ledger-sequence advances in tests never expire entries.
    /// - A Stellar-asset token contract is registered with `admin` as issuer.
    pub fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.min_persistent_entry_ttl = TEST_TTL;
            li.min_temp_entry_ttl = TEST_TTL;
        });

        let admin = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let creator = Address::generate(&env);
        let fan = Address::generate(&env);

        // Register a Stellar-asset token so it speaks the standard token
        // interface (balance, transfer, mint) that all contracts expect.
        let token_reg = env.register_stellar_asset_contract_v2(admin.clone());
        let token_address = token_reg.address();

        // SAFETY: the clients borrow `env` which lives inside `TestEnv`.
        // We extend the lifetime to `'static` here because `TestEnv` owns
        // `env` and the clients will never outlive it.
        let token_client = unsafe {
            core::mem::transmute::<TokenClient<'_>, TokenClient<'static>>(TokenClient::new(
                &env,
                &token_address,
            ))
        };
        let token_admin_client = unsafe {
            core::mem::transmute::<StellarAssetClient<'_>, StellarAssetClient<'static>>(
                StellarAssetClient::new(&env, &token_address),
            )
        };

        Self {
            env,
            admin,
            fee_recipient,
            creator,
            fan,
            token_address,
            token_client,
            token_admin_client,
        }
    }

    /// Mint `amount` tokens to `to` using the admin-controlled asset client.
    pub fn mint(&self, to: &Address, amount: i128) {
        self.token_admin_client.mint(to, &amount);
    }

    /// Advance the ledger sequence by `n` without changing the timestamp.
    pub fn advance_ledger(&self, n: u32) {
        self.env.ledger().with_mut(|li| {
            li.sequence_number += n;
        });
    }
}

impl Default for TestEnv {
    fn default() -> Self {
        Self::new()
    }
}
