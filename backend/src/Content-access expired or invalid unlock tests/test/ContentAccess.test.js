const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ContentAccess", function () {
  let contentAccess;
  let owner, buyer, nonBuyer;
  const CONTENT_ID = 1;
  const DURATION = 3600; // 1 hour

  beforeEach(async function () {
    [owner, buyer, nonBuyer] = await ethers.getSigners();
    const ContentAccess = await ethers.getContractFactory("ContentAccess");
    contentAccess = await ContentAccess.deploy();
  });

  describe("Purchase and Unlock", function () {
    it("Should allow purchase and successful unlock", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      const receipt = await tx.wait();
      const purchaseId = 1;

      await expect(contentAccess.connect(buyer).unlock(purchaseId, CONTENT_ID))
        .to.emit(contentAccess, "ContentUnlocked")
        .withArgs(purchaseId, buyer.address, CONTENT_ID);
    });
  });

  describe("Unlock with expired purchase", function () {
    it("Should revert when purchase has expired", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      await tx.wait();
      const purchaseId = 1;

      // Fast forward time beyond expiry
      await time.increase(DURATION + 1);

      await expect(
        contentAccess.connect(buyer).unlock(purchaseId, CONTENT_ID),
      ).to.be.revertedWithCustomError(contentAccess, "PurchaseExpired");
    });

    it("Should revert exactly at expiry time", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      await tx.wait();
      const purchaseId = 1;

      // Fast forward to exact expiry time
      await time.increase(DURATION);

      await expect(
        contentAccess.connect(buyer).unlock(purchaseId, CONTENT_ID),
      ).to.be.revertedWithCustomError(contentAccess, "PurchaseExpired");
    });
  });

  describe("Unlock with wrong content_id", function () {
    it("Should revert when content_id does not match", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      await tx.wait();
      const purchaseId = 1;
      const wrongContentId = 999;

      await expect(
        contentAccess.connect(buyer).unlock(purchaseId, wrongContentId),
      ).to.be.revertedWithCustomError(contentAccess, "InvalidContentId");
    });

    it("Should revert with content_id zero when purchased different id", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      await tx.wait();
      const purchaseId = 1;

      await expect(
        contentAccess.connect(buyer).unlock(purchaseId, 0),
      ).to.be.revertedWithCustomError(contentAccess, "InvalidContentId");
    });
  });

  describe("Unlock as non-buyer", function () {
    it("Should revert when caller is not the buyer", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      await tx.wait();
      const purchaseId = 1;

      await expect(
        contentAccess.connect(nonBuyer).unlock(purchaseId, CONTENT_ID),
      ).to.be.revertedWithCustomError(contentAccess, "NotBuyer");
    });

    it("Should revert when owner tries to unlock buyer's purchase", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      await tx.wait();
      const purchaseId = 1;

      await expect(
        contentAccess.connect(owner).unlock(purchaseId, CONTENT_ID),
      ).to.be.revertedWithCustomError(contentAccess, "NotBuyer");
    });
  });

  describe("Edge cases", function () {
    it("Should revert for non-existent purchase", async function () {
      const nonExistentPurchaseId = 999;

      await expect(
        contentAccess.connect(buyer).unlock(nonExistentPurchaseId, CONTENT_ID),
      ).to.be.revertedWithCustomError(contentAccess, "PurchaseNotFound");
    });

    it("Should allow unlock just before expiry", async function () {
      const tx = await contentAccess
        .connect(buyer)
        .purchase(CONTENT_ID, DURATION);
      await tx.wait();
      const purchaseId = 1;

      // Fast forward to just before expiry (leave buffer for block timestamp)
      await time.increase(DURATION - 10);

      await expect(
        contentAccess.connect(buyer).unlock(purchaseId, CONTENT_ID),
      ).to.emit(contentAccess, "ContentUnlocked");
    });
  });
});
