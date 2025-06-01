pub mod components {
    pub mod user_component {
        pub mod interface;
        pub mod mock;
        pub mod test;
        pub mod types;
        pub mod user;
    }

    pub mod content_component {
        pub mod content;
        pub mod interface;
        pub mod mock;
        pub mod test;
        pub mod types;
    }
}

pub mod interfaces {
    pub mod IERC20;
    pub mod IMyFans;
}
pub mod myfans;

pub mod mocks {
    pub mod mock_erc20;
}
