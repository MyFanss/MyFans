// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ContentAccess {
    struct Purchase {
        address buyer;
        uint256 contentId;
        uint256 expiryTime;
        bool isActive;
    }
    
    mapping(uint256 => Purchase) public purchases;
    uint256 public purchaseCounter;
    
    event ContentPurchased(uint256 indexed purchaseId, address indexed buyer, uint256 indexed contentId, uint256 expiryTime);
    event ContentUnlocked(uint256 indexed purchaseId, address indexed buyer, uint256 indexed contentId);
    
    error PurchaseExpired();
    error InvalidContentId();
    error NotBuyer();
    error PurchaseNotFound();
    
    function purchase(uint256 _contentId, uint256 _duration) external returns (uint256) {
        purchaseCounter++;
        uint256 purchaseId = purchaseCounter;
        
        purchases[purchaseId] = Purchase({
            buyer: msg.sender,
            contentId: _contentId,
            expiryTime: block.timestamp + _duration,
            isActive: true
        });
        
        emit ContentPurchased(purchaseId, msg.sender, _contentId, block.timestamp + _duration);
        return purchaseId;
    }
    
    function unlock(uint256 _purchaseId, uint256 _contentId) external {
        Purchase storage p = purchases[_purchaseId];
        
        if (!p.isActive) revert PurchaseNotFound();
        if (block.timestamp >= p.expiryTime) revert PurchaseExpired();
        if (p.contentId != _contentId) revert InvalidContentId();
        if (p.buyer != msg.sender) revert NotBuyer();
        
        emit ContentUnlocked(_purchaseId, msg.sender, _contentId);
    }
}
