#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    pub fn version(_env: Env) -> u32 {
        1
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_instantiate() {
        let env = Env::default();
        let contract_id = env.register_contract(None, MyFansToken);
        let client = MyFansTokenClient::new(&env, &contract_id);
        
        assert_eq!(client.version(), 1);
    }
}
