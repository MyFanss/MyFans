use core::result::ResultTrait;
use core::traits::TryInto;
use myfans::components::user_component::interface::{IUserDispatcher, IUserDispatcherTrait};
use myfans::interfaces::IERC20::{IERC20Dispatcher, IERC20DispatcherTrait};
use myfans::interfaces::IMyFans::{IMyFansDispatcher, IMyFansDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address, 
    spy_events, EventSpyAssertionsTrait, Event,
};
use starknet::{ContractAddress, get_block_timestamp};

pub fn OWNER() -> ContractAddress {
    'OWNER'.try_into().unwrap()
}

pub fn FAN1() -> ContractAddress {
    'FAN1'.try_into().unwrap()
}

pub fn CREATOR1() -> ContractAddress {
    'CREATOR1'.try_into().unwrap()
}

pub fn NON_CREATOR() -> ContractAddress {
    'NON_CREATOR'.try_into().unwrap()
}

pub fn RELAYER() -> ContractAddress {
    'RELAYER'.try_into().unwrap()
}

// Use u256::pow directly after importing the trait
const TENPOWEIGHTHEEN: u256 = 1000_000_000_000_000_000_u256; // 10^18
const SUBSCRIPTION_FEE: u256 = 10 * TENPOWEIGHTHEEN;
const SUBSCRIPTION_DURATION_DAYS: u64 = 30;
const INITIAL_TIMESTAMP: u64 = 1000;
const DAY_IN_SECONDS: u64 = 24 * 60 * 60;
const SUBSCRIPTION_DURATION_SECONDS: u64 = SUBSCRIPTION_DURATION_DAYS * DAY_IN_SECONDS;


struct SetupResult {
    myfans_contract_address: ContractAddress,
    erc20_contract_address: ContractAddress,
    owner_address: ContractAddress,
    fan1_address: ContractAddress,
    creator1_address: ContractAddress,
}

fn setup_erc20(owner: ContractAddress) -> ContractAddress {
    let contract = declare("MockToken").unwrap();

    let name: ByteArray = "MockToken";

    let mut constructor_calldata = array![];
    owner.serialize(ref constructor_calldata);
    name.serialize(ref constructor_calldata);

    let (erc20_address, _) = contract.contract_class().deploy(@constructor_calldata).unwrap();
    erc20_address
}

fn setup_myfans(
    fee_token_address: ContractAddress, subscription_fee: u256, subscription_duration_days: u64,
) -> ContractAddress {
    let contract = declare("MyFans").unwrap();
    let mut constructor_calldata = array![
        fee_token_address.into(),
        subscription_fee.low.into(),
        subscription_fee.high.into(),
        subscription_duration_days.into(),
    ];
    let (myfans_address, _) = contract.contract_class().deploy(@constructor_calldata).unwrap();
    myfans_address
}

fn setup_full_env() -> SetupResult {
    let owner_address: ContractAddress = OWNER();
    let fan1_address: ContractAddress = FAN1();
    let creator1_address: ContractAddress = CREATOR1();

    let erc20_address = setup_erc20(owner_address);

    let myfans_address = setup_myfans(erc20_address, SUBSCRIPTION_FEE, SUBSCRIPTION_DURATION_DAYS);

    // Distribute some tokens to fan1 for testing
    let erc20_dispatcher = IERC20Dispatcher { contract_address: erc20_address };

    start_cheat_caller_address(erc20_address, owner_address);
    erc20_dispatcher
        .transfer(fan1_address, SUBSCRIPTION_FEE * 2); // Give fan enough for 2 subscriptions

    stop_cheat_caller_address(erc20_address);

    // Setup creator account
    let myfans_user_dispatcher = IUserDispatcher { contract_address: myfans_address };

    start_cheat_caller_address(myfans_address, creator1_address);
    myfans_user_dispatcher.create_account('creator1');

    stop_cheat_caller_address(myfans_address);

    SetupResult {
        myfans_contract_address: myfans_address,
        erc20_contract_address: erc20_address,
        owner_address,
        fan1_address,
        creator1_address,
    }
}

#[test]
fn test_subscribe_successfully() {
    let setup_res = setup_full_env();
    let myfans_dispatcher = IMyFansDispatcher {
        contract_address: setup_res.myfans_contract_address,
    };
    let erc20_dispatcher = IERC20Dispatcher { contract_address: setup_res.erc20_contract_address };

    // Fan1 approves MyFans contract to spend tokens
    start_cheat_caller_address(setup_res.erc20_contract_address, setup_res.fan1_address);
    erc20_dispatcher.approve(setup_res.myfans_contract_address, SUBSCRIPTION_FEE);
    stop_cheat_caller_address(setup_res.erc20_contract_address);

    // Fan1 subscribes to Creator1

    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address);

    stop_cheat_caller_address(setup_res.myfans_contract_address);

    let sub_details = myfans_dispatcher
        .get_subscription_details(setup_res.fan1_address, setup_res.creator1_address);

    assert(sub_details.is_active, 'Subscription should be active');
    assert(sub_details.fan == setup_res.fan1_address, 'Fan address mismatch');
    assert(sub_details.creator == setup_res.creator1_address, 'Creator address mismatch');
    let expected_expiry = sub_details.start_time + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60;
    assert(sub_details.expiry_time == expected_expiry, 'Expiry time mismatch');

    // Verify fee transfer
    let contract_balance = erc20_dispatcher.balance_of(setup_res.myfans_contract_address);
    assert(contract_balance == SUBSCRIPTION_FEE, 'Contract fee incorrect');
    let fan_balance_after = erc20_dispatcher.balance_of(setup_res.fan1_address);
    // Initial fan balance was SUBSCRIPTION_FEE * 2
    assert(fan_balance_after == SUBSCRIPTION_FEE, 'Fan balance incorrect after sub');
}

#[test]
#[should_panic(expected: ('Subscription already active',))]
fn test_subscribe_duplicate_active_subscription() {
    let setup_res = setup_full_env();
    let myfans_dispatcher = IMyFansDispatcher {
        contract_address: setup_res.myfans_contract_address,
    };
    let erc20_dispatcher = IERC20Dispatcher { contract_address: setup_res.erc20_contract_address };

    // Fan1 approves MyFans contract

    start_cheat_caller_address(setup_res.erc20_contract_address, setup_res.fan1_address);
    erc20_dispatcher.approve(setup_res.myfans_contract_address, SUBSCRIPTION_FEE * 2);

    stop_cheat_caller_address(setup_res.erc20_contract_address);

    // First subscription

    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address);

    stop_cheat_caller_address(setup_res.myfans_contract_address);

    // Attempt second subscription immediately

    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address); // This should panic

    stop_cheat_caller_address(setup_res.myfans_contract_address);
}

#[test]
#[should_panic(expected: ('Creator not found',))]
fn test_subscribe_to_non_creator() {
    let setup_res = setup_full_env();
    let myfans_dispatcher = IMyFansDispatcher {
        contract_address: setup_res.myfans_contract_address,
    };
    let erc20_dispatcher = IERC20Dispatcher { contract_address: setup_res.erc20_contract_address };
    let non_creator_address: ContractAddress = NON_CREATOR();

    // Fan1 approves MyFans contract

    start_cheat_caller_address(setup_res.erc20_contract_address, setup_res.fan1_address);
    erc20_dispatcher.approve(setup_res.myfans_contract_address, SUBSCRIPTION_FEE);

    stop_cheat_caller_address(setup_res.erc20_contract_address);

    // Attempt to subscribe to a non-creator

    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(non_creator_address); // This should panic

    stop_cheat_caller_address(setup_res.myfans_contract_address);
}

#[test]
#[should_panic(expected: ('Fee transfer failed',))]
fn test_subscribe_insufficient_allowance() {
    let setup_res = setup_full_env();
    let myfans_dispatcher = IMyFansDispatcher {
        contract_address: setup_res.myfans_contract_address,
    };
    // Fan1 does NOT approve MyFans contract

    // Attempt to subscribe

    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address); // This should panic

    stop_cheat_caller_address(setup_res.myfans_contract_address);
}

#[test]
fn test_renew_subscription_expired_by_fan() {
    let setup_res = setup_full_env();
    let myfans_dispatcher = IMyFansDispatcher {
        contract_address: setup_res.myfans_contract_address,
    };
    let erc20_dispatcher = IERC20Dispatcher { contract_address: setup_res.erc20_contract_address };
    let mut spy = spy_events();

    // Fan1 approves MyFans contract to spend tokens for subscription and renewal
    start_cheat_caller_address(setup_res.erc20_contract_address, setup_res.fan1_address);
    erc20_dispatcher.approve(setup_res.myfans_contract_address, SUBSCRIPTION_FEE * 2);
    stop_cheat_caller_address(setup_res.erc20_contract_address);

    // Cheat timestamp for initial subscription to make it expire soon
    let initial_sub_time = INITIAL_TIMESTAMP;
    start_cheat_block_timestamp(setup_res.myfans_contract_address, initial_sub_time);

    // Fan1 subscribes to Creator1
    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address);
    stop_cheat_caller_address(setup_res.myfans_contract_address);
    stop_cheat_block_timestamp(setup_res.myfans_contract_address);

    // Cheat timestamp to be after expiry
    let renewal_time = initial_sub_time + SUBSCRIPTION_DURATION_SECONDS + 100;
    start_cheat_block_timestamp(setup_res.myfans_contract_address, renewal_time);

    // Renew subscription by FAN1
    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.renew_subscription(setup_res.fan1_address, setup_res.creator1_address);
    stop_cheat_caller_address(setup_res.myfans_contract_address);
    stop_cheat_block_timestamp(setup_res.myfans_contract_address);

    // Verify the updated subscription details
    let sub_details = myfans_dispatcher
        .get_subscription_details(setup_res.fan1_address, setup_res.creator1_address);

    assert(sub_details.is_active, 'Subscription is not active');
    assert(sub_details.start_time == renewal_time, 'Renewal start time mismatch'); // Should renew from current time
    let expected_expiry = renewal_time + SUBSCRIPTION_DURATION_SECONDS;
    assert(sub_details.expiry_time == expected_expiry, 'Renewal expiry time mismatch');

    // Verify fee transfer
    let contract_balance = erc20_dispatcher.balance_of(setup_res.myfans_contract_address);
    assert(contract_balance == SUBSCRIPTION_FEE * 2, 'Contract fee incorrect');
    let fan_balance_after = erc20_dispatcher.balance_of(setup_res.fan1_address);
    // Initial: 3*FEE, subscribed: 2*FEE, renewed: 1*FEE
    assert(fan_balance_after == 0, 'Fan balance incorrect');

    // Verify event emission
    let expected_renewed_event = myfans::MyFans::Event::Renewed(
        myfans::MyFans::Renewed {
            fan: setup_res.fan1_address,
            creator: setup_res.creator1_address,
            new_expiry_time: expected_expiry,
            renewed_by: setup_res.fan1_address,
        },
    );
    // Need to assert both events (subscribe + renew) if not clearing spy
    spy
        .assert_emitted(
            @array![
                (
                    setup_res.myfans_contract_address,
                    myfans::MyFans::Event::Subscribed(
                        myfans::MyFans::Subscribed {
                            fan: setup_res.fan1_address,
                            creator: setup_res.creator1_address,
                            expiry_time: initial_sub_time + SUBSCRIPTION_DURATION_SECONDS
                        }
                    )
                ), (setup_res.myfans_contract_address, expected_renewed_event)
            ],
        );
}

#[test]
fn test_renew_subscription_not_expired_by_fan() {
    let setup_res = setup_full_env();
    let myfans_dispatcher = IMyFansDispatcher {
        contract_address: setup_res.myfans_contract_address,
    };
    let erc20_dispatcher = IERC20Dispatcher { contract_address: setup_res.erc20_contract_address };
    let mut spy = spy_events();

    // Fan1 approves MyFans contract to spend tokens for subscription and renewal
    start_cheat_caller_address(setup_res.erc20_contract_address, setup_res.fan1_address);
    erc20_dispatcher.approve(setup_res.myfans_contract_address, SUBSCRIPTION_FEE * 2);
    stop_cheat_caller_address(setup_res.erc20_contract_address);

    // Cheat timestamp for initial subscription
    let initial_sub_time = INITIAL_TIMESTAMP;
    start_cheat_block_timestamp(setup_res.myfans_contract_address, initial_sub_time);

    // Fan1 subscribes to Creator1
    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address);
    stop_cheat_caller_address(setup_res.myfans_contract_address);
    stop_cheat_block_timestamp(setup_res.myfans_contract_address);

    // Get initial expiry time
    let sub_details_before_renew = myfans_dispatcher
        .get_subscription_details(setup_res.fan1_address, setup_res.creator1_address);
    let original_expiry_time = sub_details_before_renew.expiry_time;

    // Cheat timestamp to be before expiry
    let renewal_time = initial_sub_time + SUBSCRIPTION_DURATION_SECONDS - 100;
    start_cheat_block_timestamp(setup_res.myfans_contract_address, renewal_time);

    // Renew subscription by FAN1
    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.renew_subscription(setup_res.fan1_address, setup_res.creator1_address);
    stop_cheat_caller_address(setup_res.myfans_contract_address);
    stop_cheat_block_timestamp(setup_res.myfans_contract_address);

    // Verify the updated subscription details
    let sub_details_after_renew = myfans_dispatcher
        .get_subscription_details(setup_res.fan1_address, setup_res.creator1_address);

    assert(sub_details_after_renew.is_active, 'Subscription is not active');
    // Should extend from original expiry time
    assert(sub_details_after_renew.start_time == original_expiry_time, 'Renewal start time mismatch');
    let expected_expiry = original_expiry_time + SUBSCRIPTION_DURATION_SECONDS;
    assert(
        sub_details_after_renew.expiry_time == expected_expiry, 'Renewal expiry time mismatch'
    );

    // Verify fee transfer
    let contract_balance = erc20_dispatcher.balance_of(setup_res.myfans_contract_address);
    assert(
        contract_balance == SUBSCRIPTION_FEE * 2, 'Contract fee incorrect'
    );
    let fan_balance_after = erc20_dispatcher.balance_of(setup_res.fan1_address);
    // Initial: 3*FEE, subscribed: 2*FEE, renewed: 1*FEE
    assert(fan_balance_after == 0, 'Fan balance incorrect');

    // Verify event emission
    let expected_renewed_event = myfans::MyFans::Event::Renewed(
        myfans::MyFans::Renewed {
            fan: setup_res.fan1_address,
            creator: setup_res.creator1_address,
            new_expiry_time: expected_expiry,
            renewed_by: setup_res.fan1_address,
        },
    );
    // Need to assert both events (subscribe + renew) if not clearing spy
    spy
        .assert_emitted(
            @array![
                (
                    setup_res.myfans_contract_address,
                    myfans::MyFans::Event::Subscribed(
                        myfans::MyFans::Subscribed {
                            fan: setup_res.fan1_address,
                            creator: setup_res.creator1_address,
                            expiry_time: original_expiry_time
                        }
                    )
                ), (setup_res.myfans_contract_address, expected_renewed_event)
            ],
        );
}


