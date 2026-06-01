use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    xdr::SorobanAuthorizationEntry,
    Address, Env, IntoVal, Symbol, TryIntoVal,
};
extern crate std;

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
    let contract_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_client = TokenClient::new(env, &contract_address);
    let admin_client = StellarAssetClient::new(env, &contract_address);
    (contract_address, token_client, admin_client)
}

#[test]
fn test_deposit_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);

    assert_eq!(token_client.balance(&treasury_id), 500);
    assert_eq!(token_client.balance(&user), 500);

    treasury_client.withdraw(&user, &200);
    assert_eq!(token_client.balance(&treasury_id), 300);
    assert_eq!(token_client.balance(&user), 700);
}

#[test]
fn test_withdraw_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, _token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &100);

    let result = treasury_client.try_withdraw(&user, &500);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::InsufficientBalance as u32,
        )))
    );
}

#[test]
fn test_unauthorized_withdraw_reverts() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    let mint_invoke = MockAuthInvoke {
        contract: &token_address,
        fn_name: "mint",
        args: soroban_sdk::vec![&env, user.clone().into_val(&env), 1000_i128.into_val(&env)],
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &mint_invoke,
    }]);
    admin_client.mint(&user, &1000);

    let init_invoke = MockAuthInvoke {
        contract: &treasury_id,
        fn_name: "initialize",
        args: soroban_sdk::vec![
            &env,
            admin.clone().into_val(&env),
            token_address.clone().into_val(&env),
        ],
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &init_invoke,
    }]);
    treasury_client.initialize(&admin, &token_address);

    let deposit_amount = 500_i128;
    let transfer_invoke = MockAuthInvoke {
        contract: &token_address,
        fn_name: "transfer",
        args: soroban_sdk::vec![
            &env,
            user.clone().into_val(&env),
            treasury_id.clone().into_val(&env),
            deposit_amount.into_val(&env),
        ],
        sub_invokes: &[],
    };
    let deposit_invoke = MockAuthInvoke {
        contract: &treasury_id,
        fn_name: "deposit",
        args: soroban_sdk::vec![
            &env,
            user.clone().into_val(&env),
            deposit_amount.into_val(&env),
        ],
        sub_invokes: &[transfer_invoke],
    };
    env.mock_auths(&[MockAuth {
        address: &user,
        invoke: &deposit_invoke,
    }]);
    treasury_client.deposit(&user, &deposit_amount);

    assert_eq!(token_client.balance(&treasury_id), 500);

    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);
    let result = treasury_client.try_withdraw(&unauthorized, &100);
    assert!(result.is_err());
}

#[test]
fn test_unauthorized_cannot_set_paused() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "initialize",
            args: soroban_sdk::vec![
                &env,
                admin.clone().into_val(&env),
                token_address.clone().into_val(&env),
            ],
            sub_invokes: &[],
        },
    }]);
    treasury_client.initialize(&admin, &token_address);

    env.set_auths(EMPTY_AUTHS);
    assert!(
        treasury_client.try_set_paused(&true).is_err(),
        "non-admin must not set paused"
    );
    assert!(
        treasury_client.try_set_paused(&false).is_err(),
        "non-admin must not clear paused"
    );

    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "set_paused",
            args: soroban_sdk::vec![&env, true.into_val(&env)],
            sub_invokes: &[],
        },
    }]);
    assert!(
        treasury_client.try_set_paused(&true).is_err(),
        "unauthorized address must not set paused"
    );
}

#[test]
fn test_pause_blocks_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, _token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.set_paused(&true);
    let result = treasury_client.try_deposit(&user, &100);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::Paused as u32
        )))
    );
}

#[test]
fn test_pause_blocks_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);
    assert_eq!(token_client.balance(&treasury_id), 500);

    treasury_client.set_paused(&true);
    let result = treasury_client.try_withdraw(&user, &100);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::Paused as u32
        )))
    );
}

#[test]
fn test_unpause_allows_deposit_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.set_paused(&true);
    treasury_client.set_paused(&false);
    treasury_client.deposit(&user, &300);
    assert_eq!(token_client.balance(&treasury_id), 300);
    treasury_client.withdraw(&user, &100);
    assert_eq!(token_client.balance(&treasury_id), 200);
}

#[test]
fn test_min_balance_blocks_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);
    treasury_client.set_min_balance(&300);

    // 500 - 300 = 200 would remain; min is 300, so withdraw 300 is ok, withdraw 201 is not
    treasury_client.withdraw(&user, &200);
    assert_eq!(token_client.balance(&treasury_id), 300);
    let result = treasury_client.try_withdraw(&user, &1); // would leave 299 < 300
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::MinBalanceViolation as u32,
        )))
    );
}

#[test]
fn test_min_balance_allows_withdraw_above_threshold() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);
    treasury_client.set_min_balance(&200);

    treasury_client.withdraw(&user, &300);
    assert_eq!(token_client.balance(&treasury_id), 200);
    assert_eq!(token_client.balance(&user), 800); // 500 after deposit + 300 from withdraw
}

#[test]
fn test_set_min_balance_negative_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    let result = treasury_client.try_set_min_balance(&-1);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::NegativeMinBalance as u32,
        )))
    );
}

#[test]
fn test_deposit_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, _, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);

    let events = env.events().all();
    let deposit_event = events.iter().find(|e| {
        e.1.first()
            .is_some_and(|t| t.try_into_val(&env).ok() == Some(Symbol::new(&env, "deposit")))
    });

    assert!(deposit_event.is_some());
    let event = deposit_event.unwrap();
    let (from, amount, token): (Address, i128, Address) = event.2.try_into_val(&env).unwrap();
    assert_eq!(from, user);
    assert_eq!(amount, 500);
    assert_eq!(token, token_address);
}

const EMPTY_AUTHS: &[SorobanAuthorizationEntry] = &[];

// ---------------------------------------------------------------------------
// Snapshot / restore consistency test
// ---------------------------------------------------------------------------

/// Verify that restoring an `Env` from a snapshot produces a contract whose
/// observable state is identical to the state at the time the snapshot was
/// taken, regardless of mutations applied after the snapshot.
#[test]
fn test_snapshot_restore_consistency() {
    // ── Setup ────────────────────────────────────────────────────────────────
    let mut env = Env::default();
    env.set_config(soroban_sdk::testutils::EnvTestConfig {
        capture_snapshot_at_drop: false,
    });
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1_000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &600);
    treasury_client.set_min_balance(&100);

    // Record the state we want to snapshot.
    let balance_before = token_client.balance(&treasury_id);
    let user_balance_before = token_client.balance(&user);

    // Capture strkeys before taking the snapshot so we can re-bind them to the
    // restored env (Address objects are host-specific and cannot cross envs).
    let to_std = |s: soroban_sdk::String| -> std::string::String {
        <soroban_sdk::String as std::string::ToString>::to_string(&s)
    };
    let treasury_strkey = to_std(treasury_id.to_string());
    let token_strkey = to_std(token_address.to_string());
    let user_strkey = to_std(user.to_string());

    // ── Take snapshot ────────────────────────────────────────────────────────
    let snapshot = env.to_snapshot();

    // ── Mutate state after snapshot ──────────────────────────────────────────
    treasury_client.withdraw(&user, &200);
    treasury_client.set_paused(&true);

    // Confirm mutations took effect.
    assert_eq!(token_client.balance(&treasury_id), balance_before - 200);
    assert!(
        treasury_client.try_deposit(&user, &1).is_err(),
        "contract should be paused after mutation"
    );

    // ── Restore from snapshot ────────────────────────────────────────────────
    let mut restored_env = Env::from_snapshot(snapshot);
    // Disable snapshot-at-drop to avoid writing test_snapshots/ files to disk.
    restored_env.set_config(soroban_sdk::testutils::EnvTestConfig {
        capture_snapshot_at_drop: false,
    });
    restored_env.mock_all_auths();

    // Re-bind addresses to the restored env using their strkeys.
    let r_treasury_id = Address::from_string(&soroban_sdk::String::from_str(
        &restored_env,
        &treasury_strkey,
    ));
    let r_token_address =
        Address::from_string(&soroban_sdk::String::from_str(&restored_env, &token_strkey));
    let r_user = Address::from_string(&soroban_sdk::String::from_str(&restored_env, &user_strkey));

    // Re-register the native Treasury contract at its original address so the
    // restored env can dispatch calls to it (native contracts are not stored in
    // ledger entries and therefore are not part of the snapshot).
    restored_env.register_contract(Some(&r_treasury_id), Treasury);

    let restored_treasury = TreasuryClient::new(&restored_env, &r_treasury_id);
    let restored_token = TokenClient::new(&restored_env, &r_token_address);

    // ── Assert consistency ───────────────────────────────────────────────────
    // Token balances must match the pre-mutation values.
    assert_eq!(
        restored_token.balance(&r_treasury_id),
        balance_before,
        "treasury token balance must match snapshot"
    );
    assert_eq!(
        restored_token.balance(&r_user),
        user_balance_before,
        "user token balance must match snapshot"
    );

    // Contract must not be paused (it was unpaused at snapshot time).
    assert!(
        restored_treasury.try_deposit(&r_user, &50).is_ok(),
        "deposit must succeed on restored (unpaused) contract"
    );

    assert_eq!(
        restored_token.balance(&r_treasury_id),
        balance_before + 50,
        "post-restore deposit must be reflected correctly"
    );
}

#[test]
fn test_initialize_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);
    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    env.set_auths(EMPTY_AUTHS);
    assert!(
        treasury_client
            .try_initialize(&admin, &token_address)
            .is_err(),
        "initialize must fail without admin auth"
    );

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "initialize",
            args: soroban_sdk::vec![
                &env,
                admin.clone().into_val(&env),
                token_address.clone().into_val(&env),
            ],
            sub_invokes: &[],
        },
    }]);
    treasury_client.initialize(&admin, &token_address);
}

#[test]
fn test_deposit_requires_from_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &token_address,
            fn_name: "mint",
            args: soroban_sdk::vec![&env, user.clone().into_val(&env), 1000_i128.into_val(&env)],
            sub_invokes: &[],
        },
    }]);
    admin_client.mint(&user, &1000);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "initialize",
            args: soroban_sdk::vec![
                &env,
                admin.clone().into_val(&env),
                token_address.clone().into_val(&env),
            ],
            sub_invokes: &[],
        },
    }]);
    treasury_client.initialize(&admin, &token_address);

    let deposit_amount = 500_i128;
    env.set_auths(EMPTY_AUTHS);
    assert!(
        treasury_client.try_deposit(&user, &deposit_amount).is_err(),
        "deposit must fail without from auth"
    );

    env.mock_auths(&[MockAuth {
        address: &user,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "deposit",
            args: soroban_sdk::vec![
                &env,
                user.clone().into_val(&env),
                deposit_amount.into_val(&env),
            ],
            sub_invokes: &[MockAuthInvoke {
                contract: &token_address,
                fn_name: "transfer",
                args: soroban_sdk::vec![
                    &env,
                    user.clone().into_val(&env),
                    treasury_id.clone().into_val(&env),
                    deposit_amount.into_val(&env),
                ],
                sub_invokes: &[],
            }],
        },
    }]);
    treasury_client.deposit(&user, &deposit_amount);
    assert_eq!(token_client.balance(&treasury_id), deposit_amount);
}

#[test]
fn test_withdraw_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &token_address,
            fn_name: "mint",
            args: soroban_sdk::vec![&env, user.clone().into_val(&env), 1000_i128.into_val(&env)],
            sub_invokes: &[],
        },
    }]);
    admin_client.mint(&user, &1000);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "initialize",
            args: soroban_sdk::vec![
                &env,
                admin.clone().into_val(&env),
                token_address.clone().into_val(&env),
            ],
            sub_invokes: &[],
        },
    }]);
    treasury_client.initialize(&admin, &token_address);

    let deposit_amount = 500_i128;
    env.mock_auths(&[MockAuth {
        address: &user,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "deposit",
            args: soroban_sdk::vec![
                &env,
                user.clone().into_val(&env),
                deposit_amount.into_val(&env),
            ],
            sub_invokes: &[MockAuthInvoke {
                contract: &token_address,
                fn_name: "transfer",
                args: soroban_sdk::vec![
                    &env,
                    user.clone().into_val(&env),
                    treasury_id.clone().into_val(&env),
                    deposit_amount.into_val(&env),
                ],
                sub_invokes: &[],
            }],
        },
    }]);
    treasury_client.deposit(&user, &deposit_amount);

    let withdraw_amount = 100_i128;
    env.set_auths(EMPTY_AUTHS);
    assert!(
        treasury_client
            .try_withdraw(&user, &withdraw_amount)
            .is_err(),
        "withdraw must fail without admin auth"
    );

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "withdraw",
            args: soroban_sdk::vec![
                &env,
                user.clone().into_val(&env),
                withdraw_amount.into_val(&env),
            ],
            sub_invokes: &[MockAuthInvoke {
                contract: &token_address,
                fn_name: "transfer",
                args: soroban_sdk::vec![
                    &env,
                    treasury_id.clone().into_val(&env),
                    user.clone().into_val(&env),
                    withdraw_amount.into_val(&env),
                ],
                sub_invokes: &[],
            }],
        },
    }]);
    treasury_client.withdraw(&user, &withdraw_amount);
    assert_eq!(
        token_client.balance(&treasury_id),
        deposit_amount - withdraw_amount
    );
}

// ── #900: initialize and admin path unit tests ────────────────────────────

#[test]
fn test_initialize_stores_admin_and_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);

    // Verify state was persisted by exercising dependent operations.
    // deposit requires TOKEN to be set; set_paused requires ADMIN to be set.
    treasury_client.set_paused(&false); // would panic if ADMIN missing
}

#[test]
fn test_initialize_idempotent_guard() {
    // Second call to initialize must revert (NotInitialized guard fires when
    // ADMIN key already exists).
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);

    let result = treasury_client.try_initialize(&admin, &token_address);
    assert!(result.is_err(), "second initialize must revert");
}

#[test]
fn test_set_paused_admin_path() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);

    // Admin can toggle paused state.
    treasury_client.set_paused(&true);
    treasury_client.set_paused(&false);
}

#[test]
fn test_set_min_balance_admin_path() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);

    // Admin sets min balance; subsequent withdraw respects it.
    treasury_client.set_min_balance(&100);
    treasury_client.withdraw(&user, &400); // leaves 100 == min_balance
    assert_eq!(token_client.balance(&treasury_id), 100);
}

// ── #901: unauthorized caller revert tests ────────────────────────────────

#[test]
fn test_unauthorized_set_min_balance_reverts() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "initialize",
            args: soroban_sdk::vec![
                &env,
                admin.clone().into_val(&env),
                token_address.clone().into_val(&env),
            ],
            sub_invokes: &[],
        },
    }]);
    treasury_client.initialize(&admin, &token_address);

    // No auth → must fail.
    env.set_auths(EMPTY_AUTHS);
    assert!(
        treasury_client.try_set_min_balance(&100).is_err(),
        "set_min_balance must fail without auth"
    );

    // Wrong signer → must fail.
    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &treasury_id,
            fn_name: "set_min_balance",
            args: soroban_sdk::vec![&env, 100_i128.into_val(&env)],
            sub_invokes: &[],
        },
    }]);
    assert!(
        treasury_client.try_set_min_balance(&100).is_err(),
        "unauthorized address must not set min_balance"
    );
}

#[test]
fn test_unauthorized_deposit_reverts() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_address, _, admin_client) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    env.mock_all_auths();
    admin_client.mint(&user, &1000);
    treasury_client.initialize(&admin, &token_address);

    // Attempt deposit without any auth.
    env.set_auths(EMPTY_AUTHS);
    assert!(
        treasury_client.try_deposit(&user, &100).is_err(),
        "deposit must fail without from auth"
    );
}

// ── #902: event emission tests ────────────────────────────────────────────

#[test]
fn test_initialize_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);

    let events = env.events().all();
    let init_event = events.iter().find(|e| {
        e.1.first()
            .is_some_and(|t| t.try_into_val(&env).ok() == Some(Symbol::new(&env, "initialized")))
    });
    assert!(init_event.is_some(), "initialized event must be emitted");

    let event = init_event.unwrap();
    let (emitted_admin, emitted_token): (Address, Address) = event.2.try_into_val(&env).unwrap();
    assert_eq!(emitted_admin, admin);
    assert_eq!(emitted_token, token_address);
}

#[test]
fn test_set_paused_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.set_paused(&true);

    let events = env.events().all();
    let paused_event = events.iter().find(|e| {
        e.1.first()
            .is_some_and(|t| t.try_into_val(&env).ok() == Some(Symbol::new(&env, "paused_set")))
    });
    assert!(paused_event.is_some(), "paused_set event must be emitted");

    let event = paused_event.unwrap();
    let paused: bool = event.2.try_into_val(&env).unwrap();
    assert!(paused);
}

#[test]
fn test_set_min_balance_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.set_min_balance(&250);

    let events = env.events().all();
    let mb_event = events.iter().find(|e| {
        e.1.first().is_some_and(|t| {
            t.try_into_val(&env).ok() == Some(Symbol::new(&env, "min_balance_set"))
        })
    });
    assert!(mb_event.is_some(), "min_balance_set event must be emitted");

    let event = mb_event.unwrap();
    let amount: i128 = event.2.try_into_val(&env).unwrap();
    assert_eq!(amount, 250);
}
