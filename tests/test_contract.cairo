use core::num::traits::zero::Zero;
use core::starknet::SyscallResultTrait;
use core::traits::{TryInto, Into};

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp
};

use starknet::{ContractAddress, get_block_timestamp};



pub mod Accounts {
    use starknet::{ContractAddress};
    use core::traits::TryInto;

    pub fn zero() -> ContractAddress {
        0x0000000000000000000000000000000000000000.try_into().unwrap()
    }

    pub fn account1() -> ContractAddress {
        'account1'.try_into().unwrap()
    }

    pub fn account2() -> ContractAddress {
        'account2'.try_into().unwrap()
    }
}

fn deploy(name: ByteArray) -> ContractAddress {
    // Deploy game contract
    let game_contract = declare(name).unwrap().contract_class();
    let constructor_args = array![];
    let (contract_address, _) = game_contract.deploy(@constructor_args).unwrap();
    contract_address
}

#[test]
fn test_can_deploy_myfans() {
    
    let contract_address = deploy("MyFans");

    start_cheat_block_timestamp(contract_address.try_into().unwrap(), 0);

    start_cheat_caller_address(contract_address, Accounts::account1());

    // Check that the contract was deployed
    assert(contract_address != Accounts::zero(), 'Contract not deployed');

    stop_cheat_block_timestamp(contract_address);
    stop_cheat_caller_address(contract_address);
}

