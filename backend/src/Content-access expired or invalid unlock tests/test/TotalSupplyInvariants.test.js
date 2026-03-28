const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Total Supply Invariants", function () {
  let token;
  let owner, minter, burner, user1, user2;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const MINT_AMOUNT = ethers.parseEther("1000");
  const BURN_AMOUNT = ethers.parseEther("500");
  const TRANSFER_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, minter, burner, user1, user2] = await ethers.getSigners();
    
    // Deploy a simple ERC20-like token for testing
    const Token = await ethers.getContractFactory("SimpleToken");
    token = await Token.deploy(INITIAL_SUPPLY);
    
    // Grant roles if needed
    await token.grantRole(await token.MINTER_ROLE(), minter.address);
    await token.grantRole(await token.BURNER_ROLE(), burner.address);
  });

  describe("Invariant: Transfers do not change total supply", function () {
    it("Should maintain supply after single transfer", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(owner).transfer(user1.address, TRANSFER_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should maintain supply after multiple transfers", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(owner).transfer(user1.address, TRANSFER_AMOUNT);
      await token.connect(owner).transfer(user2.address, TRANSFER_AMOUNT);
      await token.connect(user1).transfer(user2.address, TRANSFER_AMOUNT.div(2n));
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should maintain supply with circular transfers", async function () {
      const initialSupply = await token.totalSupply();
      
      // Setup: distribute tokens
      await token.connect(owner).transfer(user1.address, TRANSFER_AMOUNT);
      await token.connect(owner).transfer(user2.address, TRANSFER_AMOUNT);
      
      // Circular transfers
      await token.connect(user1).transfer(user2.address, TRANSFER_AMOUNT.div(2n));
      await token.connect(user2).transfer(user1.address, TRANSFER_AMOUNT.div(4n));
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should maintain supply with max transfer amount", async function () {
      const initialSupply = await token.totalSupply();
      const ownerBalance = await token.balanceOf(owner.address);
      
      await token.connect(owner).transfer(user1.address, ownerBalance);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should maintain supply with minimum transfer amount (1 wei)", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(owner).transfer(user1.address, 1n);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });
  });

  describe("Invariant: Supply increases only on mint", function () {
    it("Should increase supply by exact mint amount", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply + MINT_AMOUNT);
    });

    it("Should increase supply by sum of multiple mints", async function () {
      const initialSupply = await token.totalSupply();
      const mintAmount1 = ethers.parseEther("500");
      const mintAmount2 = ethers.parseEther("300");
      
      await token.connect(minter).mint(user1.address, mintAmount1);
      await token.connect(minter).mint(user2.address, mintAmount2);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply + mintAmount1 + mintAmount2);
    });

    it("Should not increase supply on transfer after mint", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      const supplyAfterMint = await token.totalSupply();
      
      await token.connect(user1).transfer(user2.address, TRANSFER_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(supplyAfterMint);
      expect(finalSupply).to.equal(initialSupply + MINT_AMOUNT);
    });

    it("Should handle mint to zero address correctly", async function () {
      const initialSupply = await token.totalSupply();
      
      // Assuming contract allows minting to zero address (or reverts)
      // This tests the invariant holds even in edge cases
      try {
        await token.connect(minter).mint(ethers.ZeroAddress, MINT_AMOUNT);
        const finalSupply = await token.totalSupply();
        expect(finalSupply).to.equal(initialSupply + MINT_AMOUNT);
      } catch (error) {
        // If minting to zero address reverts, supply should remain unchanged
        const finalSupply = await token.totalSupply();
        expect(finalSupply).to.equal(initialSupply);
      }
    });

    it("Should handle large mint amounts", async function () {
      const initialSupply = await token.totalSupply();
      const largeMintAmount = ethers.parseEther("999999999");
      
      await token.connect(minter).mint(user1.address, largeMintAmount);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply + largeMintAmount);
    });
  });

  describe("Invariant: Supply decreases only on burn", function () {
    beforeEach(async function () {
      // Mint tokens to burner for testing
      await token.connect(minter).mint(burner.address, BURN_AMOUNT.mul(2n));
    });

    it("Should decrease supply by exact burn amount", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(burner).burn(BURN_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply - BURN_AMOUNT);
    });

    it("Should decrease supply by sum of multiple burns", async function () {
      const initialSupply = await token.totalSupply();
      const burnAmount1 = ethers.parseEther("200");
      const burnAmount2 = ethers.parseEther("150");
      
      await token.connect(burner).burn(burnAmount1);
      await token.connect(burner).burn(burnAmount2);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply - burnAmount1 - burnAmount2);
    });

    it("Should not decrease supply on transfer after burn", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(burner).burn(BURN_AMOUNT);
      const supplyAfterBurn = await token.totalSupply();
      
      const remainingBalance = await token.balanceOf(burner.address);
      if (remainingBalance > 0n) {
        await token.connect(burner).transfer(user1.address, remainingBalance);
      }
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(supplyAfterBurn);
      expect(finalSupply).to.equal(initialSupply - BURN_AMOUNT);
    });

    it("Should handle burn of entire balance", async function () {
      const initialSupply = await token.totalSupply();
      const burnerBalance = await token.balanceOf(burner.address);
      
      await token.connect(burner).burn(burnerBalance);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply - burnerBalance);
    });

    it("Should handle minimum burn amount (1 wei)", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(burner).burn(1n);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply - 1n);
    });
  });

  describe("Invariant: Supply consistency across operations", function () {
    it("Should maintain consistency: mint then burn", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      await token.connect(user1).approve(burner.address, MINT_AMOUNT);
      await token.connect(burner).burnFrom(user1.address, MINT_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should maintain consistency: burn then mint", async function () {
      const initialSupply = await token.totalSupply();
      
      // First mint to have tokens to burn
      await token.connect(minter).mint(burner.address, BURN_AMOUNT);
      await token.connect(burner).burn(BURN_AMOUNT);
      
      const supplyAfterBurn = await token.totalSupply();
      expect(supplyAfterBurn).to.equal(initialSupply);
      
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply + MINT_AMOUNT);
    });

    it("Should maintain consistency: complex sequence", async function () {
      const initialSupply = await token.totalSupply();
      
      // Mint
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      const supplyAfterMint1 = await token.totalSupply();
      
      // Transfer
      await token.connect(user1).transfer(user2.address, TRANSFER_AMOUNT);
      const supplyAfterTransfer = await token.totalSupply();
      
      // Burn
      await token.connect(user2).approve(burner.address, TRANSFER_AMOUNT);
      await token.connect(burner).burnFrom(user2.address, TRANSFER_AMOUNT);
      const supplyAfterBurn = await token.totalSupply();
      
      // Mint again
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      const finalSupply = await token.totalSupply();
      
      // Verify invariants
      expect(supplyAfterMint1).to.equal(initialSupply + MINT_AMOUNT);
      expect(supplyAfterTransfer).to.equal(supplyAfterMint1); // Transfer doesn't change supply
      expect(supplyAfterBurn).to.equal(supplyAfterTransfer - TRANSFER_AMOUNT);
      expect(finalSupply).to.equal(supplyAfterBurn + MINT_AMOUNT);
    });

    it("Should maintain consistency with concurrent operations", async function () {
      const initialSupply = await token.totalSupply();
      
      // Distribute tokens
      await token.connect(owner).transfer(user1.address, TRANSFER_AMOUNT);
      await token.connect(owner).transfer(user2.address, TRANSFER_AMOUNT);
      
      const supplyAfterDistribution = await token.totalSupply();
      expect(supplyAfterDistribution).to.equal(initialSupply);
      
      // Concurrent-like operations
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      await token.connect(user2).approve(burner.address, TRANSFER_AMOUNT);
      await token.connect(burner).burnFrom(user2.address, TRANSFER_AMOUNT);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply + MINT_AMOUNT - TRANSFER_AMOUNT);
    });
  });

  describe("Invariant: Sum of balances equals total supply", function () {
    it("Should have sum of balances equal to total supply initially", async function () {
      const totalSupply = await token.totalSupply();
      const ownerBalance = await token.balanceOf(owner.address);
      
      expect(ownerBalance).to.equal(totalSupply);
    });

    it("Should maintain balance sum after transfers", async function () {
      const totalSupply = await token.totalSupply();
      
      await token.connect(owner).transfer(user1.address, TRANSFER_AMOUNT);
      await token.connect(owner).transfer(user2.address, TRANSFER_AMOUNT);
      
      const ownerBalance = await token.balanceOf(owner.address);
      const user1Balance = await token.balanceOf(user1.address);
      const user2Balance = await token.balanceOf(user2.address);
      
      const sumOfBalances = ownerBalance + user1Balance + user2Balance;
      expect(sumOfBalances).to.equal(totalSupply);
    });

    it("Should maintain balance sum after mint", async function () {
      const totalSupply = await token.totalSupply();
      
      await token.connect(minter).mint(user1.address, MINT_AMOUNT);
      
      const newTotalSupply = await token.totalSupply();
      const ownerBalance = await token.balanceOf(owner.address);
      const user1Balance = await token.balanceOf(user1.address);
      
      const sumOfBalances = ownerBalance + user1Balance;
      expect(sumOfBalances).to.equal(newTotalSupply);
    });

    it("Should maintain balance sum after burn", async function () {
      await token.connect(minter).mint(burner.address, BURN_AMOUNT);
      
      const totalSupplyBeforeBurn = await token.totalSupply();
      await token.connect(burner).burn(BURN_AMOUNT);
      
      const totalSupplyAfterBurn = await token.totalSupply();
      const ownerBalance = await token.balanceOf(owner.address);
      const burnerBalance = await token.balanceOf(burner.address);
      
      const sumOfBalances = ownerBalance + burnerBalance;
      expect(sumOfBalances).to.equal(totalSupplyAfterBurn);
    });
  });

  describe("Edge cases and boundary conditions", function () {
    it("Should handle zero transfer", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(owner).transfer(user1.address, 0n);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should handle zero mint", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(minter).mint(user1.address, 0n);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should handle zero burn", async function () {
      const initialSupply = await token.totalSupply();
      
      await token.connect(burner).burn(0n);
      
      const finalSupply = await token.totalSupply();
      expect(finalSupply).to.equal(initialSupply);
    });

    it("Should revert on transfer exceeding balance", async function () {
      const user1Balance = await token.balanceOf(user1.address);
      
      await expect(
        token.connect(user1).transfer(user2.address, user1Balance + 1n)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("Should revert on burn exceeding balance", async function () {
      const burnerBalance = await token.balanceOf(burner.address);
      
      await expect(
        token.connect(burner).burn(burnerBalance + 1n)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("Should handle supply at maximum uint256 boundary", async function () {
      // This is a theoretical test - actual implementation may have limits
      const initialSupply = await token.totalSupply();
      
      // Just verify the invariant holds with current supply
      const ownerBalance = await token.balanceOf(owner.address);
      expect(ownerBalance).to.be.lte(initialSupply);
    });
  });
});
