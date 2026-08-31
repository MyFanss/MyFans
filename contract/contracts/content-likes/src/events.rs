use soroban_sdk::{contracttype, Address};

/// Stable topic keys for content-likes events.
/// Indexers should key on these constants.
pub const TOPIC_LIKED: &str = "liked";
pub const TOPIC_UNLIKED: &str = "unliked";

/// Event emitted when a user likes content.
///
/// Topics: (liked, content_id)
/// Data: user
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LikedEvent {
    pub user: Address,
    pub content_id: u32,
}

/// Event emitted when a user unlikes content.
///
/// Topics: (unliked, content_id)
/// Data: user
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnlikedEvent {
    pub user: Address,
    pub content_id: u32,
}
