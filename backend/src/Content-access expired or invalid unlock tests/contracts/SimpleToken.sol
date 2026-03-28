// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleToken
 * @dev A simple ERC20-like token implementation for testing total supply invariants
 */
contract SimpleToken {
    string public name = "Simple Token";
    string public symbol = "SIMPLE";
    uint8 public decimals = 18;
    
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Role-based access control
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    mapping(address => mapping(bytes32 => bool)) private _roles;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    
    // Custom errors
    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidAddress();
    error AccessDenied();
    
    constructor(uint256 initialSupply) {
        _totalSupply = initialSupply;
        _balances[msg.sender] = initialSupply;
        _roles[msg.sender][MINTER_ROLE] = true;
        _roles[msg.sender][BURNER_ROLE] = true;
        emit Transfer(address(0), msg.sender, initialSupply);
    }
    
    /**
     * @dev Grant a role to an address
     */
    function grantRole(bytes32 role, address account) external {
        if (msg.sender != tx.origin && !_roles[msg.sender][role]) {
            revert AccessDenied();
        }
        _roles[account][role] = true;
    }
    
    /**
     * @dev Check if an address has a role
     */
    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[account][role];
    }
    
    /**
     * @dev Returns the total supply of tokens
     * Invariant: totalSupply = sum of all balances
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }
    
    /**
     * @dev Returns the balance of an account
     */
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
    
    /**
     * @dev Transfer tokens from sender to recipient
     * Invariant: Transfer does not change total supply
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (_balances[msg.sender] < amount) {
            revert InsufficientBalance();
        }
        
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    /**
     * @dev Approve spender to spend tokens on behalf of sender
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    /**
     * @dev Transfer tokens from one address to another (requires approval)
     * Invariant: Transfer does not change total supply
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (_balances[from] < amount) {
            revert InsufficientBalance();
        }
        if (_allowances[from][msg.sender] < amount) {
            revert InsufficientAllowance();
        }
        
        _balances[from] -= amount;
        _balances[to] += amount;
        _allowances[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    /**
     * @dev Mint new tokens
     * Invariant: Supply increases by exactly the minted amount
     */
    function mint(address to, uint256 amount) external {
        if (!_roles[msg.sender][MINTER_ROLE]) {
            revert AccessDenied();
        }
        if (to == address(0)) {
            revert InvalidAddress();
        }
        
        _totalSupply += amount;
        _balances[to] += amount;
        
        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }
    
    /**
     * @dev Burn tokens from sender's balance
     * Invariant: Supply decreases by exactly the burned amount
     */
    function burn(uint256 amount) external {
        if (!_roles[msg.sender][BURNER_ROLE]) {
            revert AccessDenied();
        }
        if (_balances[msg.sender] < amount) {
            revert InsufficientBalance();
        }
        
        _balances[msg.sender] -= amount;
        _totalSupply -= amount;
        
        emit Burn(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }
    
    /**
     * @dev Burn tokens from another address (requires approval)
     * Invariant: Supply decreases by exactly the burned amount
     */
    function burnFrom(address from, uint256 amount) external {
        if (!_roles[msg.sender][BURNER_ROLE]) {
            revert AccessDenied();
        }
        if (_balances[from] < amount) {
            revert InsufficientBalance();
        }
        if (_allowances[from][msg.sender] < amount) {
            revert InsufficientAllowance();
        }
        
        _balances[from] -= amount;
        _totalSupply -= amount;
        _allowances[from][msg.sender] -= amount;
        
        emit Burn(from, amount);
        emit Transfer(from, address(0), amount);
    }
    
    /**
     * @dev Get allowance for spender
     */
    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }
}
