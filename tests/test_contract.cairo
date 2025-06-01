use core::result::ResultTrait;
use core::traits::TryInto;
use myfans::components::user_component::interface::{IUserDispatcher, IUserDispatcherTrait};
use myfans::interfaces::IERC20::{IERC20Dispatcher, IERC20DispatcherTrait};
use myfans::interfaces::IMyFans::{IMyFansDispatcher, IMyFansDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
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

// Use u256::pow directly after importing the trait
const TENPOWEIGHTHEEN: u256 = 1000_000_000_000_000_000_u256; // 10^18
const SUBSCRIPTION_FEE: u256 = 10 * TENPOWEIGHTHEEN;
const SUBSCRIPTION_DURATION_DAYS: u64 = 30;

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
fn test_subscribe_after_expiry() {
    let setup_res = setup_full_env();
    let myfans_dispatcher = IMyFansDispatcher {
        contract_address: setup_res.myfans_contract_address,
    };
    let erc20_dispatcher = IERC20Dispatcher { contract_address: setup_res.erc20_contract_address };

    // Fan1 approves MyFans contract for two subscriptions

    start_cheat_caller_address(setup_res.erc20_contract_address, setup_res.fan1_address);
    erc20_dispatcher.approve(setup_res.myfans_contract_address, SUBSCRIPTION_FEE * 2);

    stop_cheat_caller_address(setup_res.erc20_contract_address);

    // First subscription

    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address);

    stop_cheat_caller_address(setup_res.myfans_contract_address);

    let first_sub_details = myfans_dispatcher
        .get_subscription_details(setup_res.fan1_address, setup_res.creator1_address);

    // Advance time past expiry
    let current_block_timestamp = get_block_timestamp();
    let time_to_advance = first_sub_details.expiry_time
        - current_block_timestamp
        + 1; // 1 second after expiry
    start_cheat_block_timestamp(
        setup_res.myfans_contract_address, current_block_timestamp + time_to_advance,
    );

    // Second subscription (should succeed as first one expired)

    start_cheat_caller_address(setup_res.myfans_contract_address, setup_res.fan1_address);
    myfans_dispatcher.subscribe(setup_res.creator1_address);

    stop_cheat_caller_address(setup_res.myfans_contract_address);

    stop_cheat_block_timestamp(setup_res.myfans_contract_address);

    let second_sub_details = myfans_dispatcher
        .get_subscription_details(setup_res.fan1_address, setup_res.creator1_address);
    assert(second_sub_details.is_active, 'Second sub should be active');
    assert(
        second_sub_details.start_time > first_sub_details.start_time,
        'Second sub start time invalid',
    );
}
