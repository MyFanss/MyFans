# MyFans
### Contract Upgrade & Migration Runbook

Network:  Stellar / Soroban

IMPORTANT: This runbook must be executed by a team member with admin key access. Keep this document and all contract IDs in a secrets manager — never in plain-text version control.

#### 1. Overview
Both contracts use Soroban's update_current_contract_wasm mechanism for upgrades. Neither contract has a built-in timelock for upgrades, so the operational process described in this runbook is the primary safety layer. All upgrades must follow this runbook in full — no shortcuts.

Key characteristics of each contract:
    • MyfansContract — has pause / unpause, making it safe to freeze before upgrade. Stores: Admin, FeeBps, FeeRecipient, PlanCount, Plan(u32), Sub(Address, Address), Token, Price, Paused.
    • CreatorRegistryContract — no pause function; upgrades must be coordinated during low-traffic windows. Stores: Admin, Creator(Address), LastRegLedger(Address). The LastRegLedger key has a legacy alias (registration_ledger) that must not be broken.

#### 2. Environment Variables & Contract IDs
All values below must be set in your shell before running any upgrade command. Store these in your team's secrets manager (e.g. Vault, 1Password, AWS Secrets Manager). Never hardcode or commit them.

Variable                            Purpose                                           Example / Notes
                                                                        
MYFANS_CONTRACT_ID                  Deployed MyfansContract address                   C... (Stellar contract ID)
CREATOR_REGISTRY_CONTRACT_ID        Deployed CreatorRegistryContract address          C... (Stellar contract ID)
ADMIN_SECRET_KEY                    Admin account signing key                         S... — keep in secrets manager only
SOROBAN_RPC_URL                     RPC endpoint for the target network               https://soroban-testnet.stellar.org
SOROBAN_NETWORK_PASSPHRASE          Network passphrase                                Test SDF Network ; September 2015
NEW_WASM_PATH                       Path to new compiled .wasm                        ./target/wasm32-unknown.../contract.wasm
TOKEN_CONTRACT_ID                   External token contract MyfansContract depends on C... (unchanged across upgrade)

SECURITY: ADMIN_SECRET_KEY must never appear in logs, CI output, or shell history. Use --secret-key=$(cat /run/secrets/admin_key) or equivalent.

##### 3. Dependency Order
The two contracts are independent — they do not call each other directly. However, MyfansContract depends on an external token contract. The correct upgrade order is:

    1. Token contract (if being upgraded) — must be upgraded first. MyfansContract reads the token address from DataKey::Token set at init time; changing the token contract address requires a new init or a separate set_token call.
    2. CreatorRegistryContract — no dependencies on MyfansContract. Upgrade independently.
    3. MyfansContract — upgrade last, after any token contract changes are confirmed stable.

NOTE: If only one contract is being upgraded, skip the steps for the other. The order above applies when upgrading both in the same release.

4. Pre-Upgrade Checklist
Complete every item before touching any on-chain state. Check off each row and record the operator name and timestamp.

Task
1. Confirm the new .wasm compiles cleanly: cargo build --target wasm32-unknown-unknown --release
2. Run the full test suite and confirm all tests pass: cargo test
3. Verify the new wasm hash with: soroban contract install --wasm $NEW_WASM_PATH --rpc-url $SOROBAN_RPC_URL --network-passphrase $SOROBAN_NETWORK_PASSPHRASE (record the output hash)
4. Confirm the stored DataKey layout is backward-compatible. Check that no DataKey variant has been removed or reordered. For CreatorRegistryContract, confirm LastRegLedger alias is preserved.
5. Snapshot current on-chain state: query Admin, FeeBps, FeeRecipient, PlanCount, Token, Price, Paused from MyfansContract. Query Admin from CreatorRegistryContract. Store snapshots in the incident ticket.
6. Notify the team in #deployments Slack channel: upgrade window, contracts affected, expected downtime (MyfansContract only, via pause).
7. Confirm backup admin key is accessible in case the primary signing key fails mid-upgrade.
8. Set all environment variables listed in Section 2 and confirm with: echo $MYFANS_CONTRACT_ID && echo $CREATOR_REGISTRY_CONTRACT_ID

#### 5. Upgrade Procedure
5.1 Compile and install the new wasm
Build the optimised wasm and install it on-chain to get the wasm hash. The install step does not affect any running contract — it only uploads bytecode.

cargo build --target wasm32-unknown-unknown --release --locked
soroban contract install \
  --wasm $NEW_WASM_PATH \
  --rpc-url $SOROBAN_RPC_URL \
  --network-passphrase "$SOROBAN_NETWORK_PASSPHRASE" \
  --source $ADMIN_SECRET_KEY

Record the printed wasm hash as NEW_WASM_HASH. You will pass it to the upgrade call.

5.2 Upgrade CreatorRegistryContract
No pause mechanism exists. Choose a low-traffic window. The upgrade is a single transaction — it is atomic.

soroban contract invoke \
  --id $CREATOR_REGISTRY_CONTRACT_ID \
  --source $ADMIN_SECRET_KEY \
  --rpc-url $SOROBAN_RPC_URL \
  --network-passphrase "$SOROBAN_NETWORK_PASSPHRASE" \
  -- upgrade --new_wasm_hash $NEW_WASM_HASH

NOTE: If the contract does not yet expose an upgrade function, it must be added before this step can execute. See Section 7 for the required function signature.

5.3 Upgrade MyfansContract
MyfansContract has pause / unpause — use them.

Step A — Pause
soroban contract invoke \
  --id $MYFANS_CONTRACT_ID \
  --source $ADMIN_SECRET_KEY \
  --rpc-url $SOROBAN_RPC_URL \
  --network-passphrase "$SOROBAN_NETWORK_PASSPHRASE" \
  -- pause

Verify the pause took effect:
soroban contract invoke --id $MYFANS_CONTRACT_ID ... -- is_paused
Expected output: true

Step B — Upgrade
soroban contract invoke \
  --id $MYFANS_CONTRACT_ID \
  --source $ADMIN_SECRET_KEY \
  --rpc-url $SOROBAN_RPC_URL \
  --network-passphrase "$SOROBAN_NETWORK_PASSPHRASE" \
  -- upgrade --new_wasm_hash $NEW_WASM_HASH

Step C — Verify storage integrity
After the upgrade call confirm that all instance storage values match the pre-upgrade snapshot:
    • Admin address unchanged
    • FeeBps unchanged
    • FeeRecipient unchanged
    • PlanCount unchanged
    • Token address unchanged
    • Price unchanged
    • Paused == true (still paused from Step A)

Step D — Unpause
soroban contract invoke \
  --id $MYFANS_CONTRACT_ID \
  --source $ADMIN_SECRET_KEY \
  --rpc-url $SOROBAN_RPC_URL \
  --network-passphrase "$SOROBAN_NETWORK_PASSPHRASE" \
  -- unpause

Verify:
soroban contract invoke --id $MYFANS_CONTRACT_ID ... -- is_paused
Expected output: false

#### 6. Post-Upgrade Checklist

Task
1. Verify is_paused returns false for MyfansContract.
2. Call get_creator_id on a known registered creator address and confirm the expected ID is returned from CreatorRegistryContract.
3. Call is_subscriber on a known active subscription and confirm it returns true.
4. Confirm Admin address on both contracts matches the pre-upgrade snapshot.
5. Place a small test subscription on a testnet deployment (if available) to exercise the full transaction path.
6. Post upgrade confirmation in #deployments Slack channel with: contract IDs, new wasm hash, operator name, timestamp.
7. Update the internal contract registry document with the new wasm hash and deployment date.
8. Close the incident/deployment ticket.

#### 7. Rollback Plan
Soroban contract upgrades are not automatically reversible — there is no built-in undo. The rollback strategy is to re-upgrade to the previous wasm hash, which must have been installed on-chain before the upgrade window.

CRITICAL: Install the previous wasm BEFORE starting the upgrade so its hash is already on-chain and available for immediate rollback if needed.

7.1 Rollback procedure
    4. If MyfansContract is unpaused and the new code is broken, pause it immediately using the procedure in Section 5.3 Step A.
    5. Re-run the upgrade call from Section 5.2 or 5.3 Step B, substituting PREV_WASM_HASH (the hash of the previously-installed wasm) for NEW_WASM_HASH.
    6. Unpause MyfansContract if applicable.
    7. Run the post-upgrade checklist from Section 6.
    8. File a post-mortem ticket describing what went wrong and why the rollback was triggered.

7.2 Storage schema rollback
If the new contract version introduced DataKey changes that are incompatible with the rolled-back wasm, the on-chain state may be corrupted. In this case:
    • Do not attempt further upgrades until the data inconsistency is fully understood.
    • For MyfansContract: the Paused flag can be set to true to prevent further user interaction while the team investigates.
    • CreatorRegistryContract has no pause — coordinate an emergency maintenance window and communicate downtime to users.
    • If state is unrecoverable, a new contract must be deployed and users migrated. This is a last resort and requires a dedicated migration runbook.

WARNING: The LastRegLedger alias in CreatorRegistryContract (DataKey::registration_ledger → DataKey::LastRegLedger) must be preserved in all future versions. Removing or renaming this key variant will corrupt rate-limit state for existing callers.

#### 8. Required Upgrade Function
Neither contract currently exposes an upgrade entry point. Before any upgrade can be executed, the following function must be added to each contract and deployed as a prerequisite release:

8.1 MyfansContract
pub fn upgrade(env: Env, new_wasm_hash: soroban_sdk::BytesN<32>) {
    let admin: Address = env
        .storage().instance().get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(&env, Error::AdminNotInitialized));
    admin.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}

8.2 CreatorRegistryContract
pub fn upgrade(env: Env, new_wasm_hash: soroban_sdk::BytesN<32>) {
    let admin: Address = env
        .storage().instance().get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
    admin.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}

NOTE: The upgrade function must be added in a separate, non-breaking release before the first functional upgrade is attempted. The prerequisite release does not require a pause because it adds only a new function and changes no existing storage or logic.

#### 9. Contract ID Handling
Soroban contract IDs are stable across upgrades — the contract address does not change when the wasm is updated via update_current_contract_wasm. This means:
    • Frontend clients and off-chain services do not need to update contract IDs after an upgrade.
    • The token contract address stored in MyfansContract::DataKey::Token is also unchanged — no re-initialization is needed unless the token contract itself is being replaced.
    • All persistent storage keys (DataKey::Plan, DataKey::Sub, DataKey::Creator, DataKey::LastRegLedger) survive the upgrade intact.

The only time a new contract ID is introduced is if a contract is re-deployed from scratch rather than upgraded. In that case:
    • Update MYFANS_CONTRACT_ID or CREATOR_REGISTRY_CONTRACT_ID in the secrets manager.
    • Re-run init on the new contract.
    • Notify all frontend teams and update any hardcoded references.
    • Coordinate migration of any persistent state that needs to be carried over.

#### 10. Contacts & Escalation
If the upgrade does not proceed as expected, escalate immediately. Do not attempt to work around a failed upgrade without looping in the team lead.

Role                                        Responsibility                                      Contact

Tech Lead                           Approves upgrade window, signs off on checklist             Fill in
Deploying Engineer                  Executes upgrade commands, runs verification                Fill in
On-call                             Available for rollback decision during window               Fill in