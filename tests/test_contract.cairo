use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::ContractAddress;

// use myfans::IHelloStarknetSafeDispatcher;
// use myfans::IHelloStarknetSafeDispatcherTrait;
// use myfans::IHelloStarknetDispatcher;
// use myfans::IHelloStarknetDispatcherTrait;

fn deploy_contract(name: ByteArray) -> ContractAddress {
    let contract = declare(name).unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@ArrayTrait::new()).unwrap();
    contract_address
}

#[test]
fn test_increase_balance() {
    let a = 2;
    (assert(a == 2, 'test fail'))
}

