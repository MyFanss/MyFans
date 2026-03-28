use soroban_sdk::{Address, Env, Symbol};

/// Stable topic keys for all transfer events.
/// Indexers should key on these constants.
pub const TOPIC_TRANSFER: &str = "transfer";
pub const TOPIC_TRANSFER_FROM: &str = "transfer_from";

/// Stable transfer event payload published for both `transfer`
/// and `transfer_from` paths so indexers see a single consistent schema.
///
/// Topics  : (topic_key: Symbol, asset: Address)
/// Data    : TransferEventData
pub struct TransferEventData {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

/// Emit a transfer event (fan → creator, direct subscription payment).
///
/// Topics : ("transfer", asset)
/// Data   : { from, to, amount }
pub fn emit_transfer(env: &Env, asset: &Address, from: &Address, to: &Address, amount: i128) {
    env.events().publish(
        (Symbol::new(env, TOPIC_TRANSFER), asset.clone()),
        (from.clone(), to.clone(), amount),
    );
}

/// Emit a transfer_from event (fan → fee_recipient, protocol fee leg).
///
/// Topics : ("transfer_from", asset)
/// Data   : { from, to, amount }
///
/// Uses the same (from, to, amount) tuple schema as `emit_transfer`
/// so both events are parsed identically by the indexer.
pub fn emit_transfer_from(env: &Env, asset: &Address, from: &Address, to: &Address, amount: i128) {
    env.events().publish(
        (Symbol::new(env, TOPIC_TRANSFER_FROM), asset.clone()),
        (from.clone(), to.clone(), amount),
    );
}