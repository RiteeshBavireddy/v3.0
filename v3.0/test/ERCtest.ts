import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { expect } from "chai";

describe("NFTDutchAuction_ERC20Bids", function() {
  let NFTDutchAuction_ERC20Bids: Contract;
  let MockERC721: Contract;
  let MockERC20: Contract;
  let signers: Signer[];
  let owner: any, addr1: any, addr2: any;
  const reservePrice = 110;
    const numBlocksAuctionOpen = 10;
    const startPrice = 110; // Define the start price
    const offerPriceDecrement = (startPrice - reservePrice) / numBlocksAuctionOpen; // Define price decrement per block


  beforeEach(async function () {
    signers = await ethers.getSigners();
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const MockERC20Factory = await ethers.getContractFactory("MockERC20", signers[0]);
    MockERC20 = await MockERC20Factory.deploy("Test Token", "TTK");

    const MockERC721Factory = await ethers.getContractFactory("MockERC721", signers[0]);
    MockERC721 = await MockERC721Factory.deploy("Test NFT", "TNFT");
    await MockERC721.mint(signers[0].getAddress(), 1);

    const NFTDutchAuction_ERC20BidsFactory = await ethers.getContractFactory("NFTDutchAuction_ERC20Bids", signers[0]);
    NFTDutchAuction_ERC20Bids = await NFTDutchAuction_ERC20BidsFactory.deploy(MockERC20.address, MockERC721.address, 1, 10, 100, 1,);

    await MockERC721.connect(signers[0]).approve(NFTDutchAuction_ERC20Bids.address, 1);
  });

  it("should mint the MockERC20 token correctly", async function() {
    await MockERC20.mint(addr1.getAddress(), 200);
    expect(await MockERC20.balanceOf(addr1.getAddress())).to.equal(200);
  });

  it("should fail to bid if bid token allowance is insufficient", async function() {
    await MockERC20.mint(addr1.getAddress(), 200);
    await MockERC20.connect(addr1).approve(NFTDutchAuction_ERC20Bids.address, 100);
    
    await expect(NFTDutchAuction_ERC20Bids.connect(addr1).bid(120)).to.be.revertedWith("Check the token allowance");
  });

  it("should allow first bid without refunding", async function() {
    await MockERC20.mint(addr1.getAddress(), 200);
    await MockERC20.connect(addr1).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(addr1).bid(120);
    expect(await MockERC20.balanceOf(addr1.getAddress())).to.equal(80);
  });
  
  it("should mint the MockERC20 token correctly", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    expect(await MockERC20.balanceOf(signers[1].getAddress())).to.equal(200);
  });

  it("should fail to bid if bid token allowance is insufficient", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 100);
    
    await expect(NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(120)).to.be.revertedWith("Check the token allowance");
  });

  it("should handle minting and burning of MockERC721 token correctly", async function() {
    await MockERC721.mint(signers[0].getAddress(), 2);
    expect(await MockERC721.ownerOf(2)).to.equal(await signers[0].getAddress());
    await MockERC721.burn(2);
    await expect(MockERC721.ownerOf(2)).to.be.revertedWith("ERC721: invalid token ID");
  });

  it("should get the correct current block number", async function() {
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    expect(await NFTDutchAuction_ERC20Bids.getCurrentBlockNumber()).to.equal(currentBlockNumber);
  });

  it("should fail to end auction if it's already ended", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(120);
    await ethers.provider.send("evm_increaseTime", [100]); // Increase EVM time to simulate blocks passing

    await NFTDutchAuction_ERC20Bids.endAuction();
    await expect(NFTDutchAuction_ERC20Bids.endAuction()).to.be.revertedWith("Auction has already ended");
  });

  it("should fail to bid if auction has ended", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(120);
    await ethers.provider.send("evm_increaseTime", [100]); // Increase EVM time to simulate blocks passing

    await NFTDutchAuction_ERC20Bids.endAuction();
    await expect(NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(130)).to.be.revertedWith("Auction has ended");
  });

  it("should fail to end auction if no bids received", async function() {
    await expect(NFTDutchAuction_ERC20Bids.endAuction()).to.be.revertedWith("No bids received");
  });

  it("should fail to bid if bid is lower than the reserve price", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    
    await expect(NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(5)).to.be.revertedWith("Bid is lower than the reserve price");
  });

  it("should fail to bid if the owner tries to bid", async function() {
    await MockERC20.mint(signers[0].getAddress(), 200);
    await MockERC20.connect(signers[0]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    
    await expect(NFTDutchAuction_ERC20Bids.connect(signers[0]).bid(150)).to.be.revertedWith("Owner cannot place a bid");
  });

  it("should accept valid bids and refund previous bids", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(120);
    expect(await MockERC20.balanceOf(signers[1].getAddress())).to.equal(80);

    await MockERC20.mint(signers[2].getAddress(), 200);
    await MockERC20.connect(signers[2]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(signers[2]).bid(130);
    expect(await MockERC20.balanceOf(signers[2].getAddress())).to.equal(70);
    expect(await MockERC20.balanceOf(signers[1].getAddress())).to.equal(200); // Refunded
  });

  it("should fail to transfer NFT if contract owner doesn't own it", async function() {
    await MockERC721.mint(signers[1].getAddress(), 2);
    await MockERC721.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 2);
    
    await expect(NFTDutchAuction_ERC20Bids.connect(signers[1]).endAuction()).to.be.reverted;
  });

it("should revert with invalid constructor parameters", async function() {
  const NFTDutchAuction_ERC20BidsFactory = await ethers.getContractFactory("NFTDutchAuction_ERC20Bids", owner);
  await expect(NFTDutchAuction_ERC20BidsFactory.deploy(MockERC20.address, MockERC721.address, 1, 0, 100, 1))
    .to.be.revertedWith("Reserve price should be greater than 0");
  await expect(NFTDutchAuction_ERC20BidsFactory.deploy(MockERC20.address, MockERC721.address, 1, 10, 0, 1))
    .to.be.revertedWith("Auction must be open for at least one block");
  await expect(NFTDutchAuction_ERC20BidsFactory.deploy(MockERC20.address, MockERC721.address, 1, 10, 100, 0))
    .to.be.revertedWith("Offer price decrement should be greater than 0");
});

it("should return the reserve price when the price drop is greater than or equal to the start price", async function() {
  // Setup auction with 1 block open and 1 token price drop per block
  const NFTDutchAuction_ERC20BidsFactory = await ethers.getContractFactory("NFTDutchAuction_ERC20Bids", signers[0]);
  NFTDutchAuction_ERC20Bids = await NFTDutchAuction_ERC20BidsFactory.deploy(MockERC20.address, MockERC721.address, 1, 10, 1, 10);
  await MockERC721.connect(signers[0]).approve(NFTDutchAuction_ERC20Bids.address, 1);
  // Fast forward 2 blocks to ensure priceDrop is greater than startPrice
  await ethers.provider.send("evm_mine", []);
  await ethers.provider.send("evm_mine", []);
  const currentPrice = await NFTDutchAuction_ERC20Bids.getCurrentPrice();
  expect(currentPrice).to.equal(10); // Reserve price
});
it("should fail to bid if auction is closed", async function() {
  await MockERC20.mint(signers[1].getAddress(), 100);
  await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 100);  
  // Fast forward 101 blocks to simulate auction end
  for(let i = 0; i < 101; i++) {
    await ethers.provider.send("evm_mine", []);
  }
  await expect(NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(130)).to.be.revertedWith("Auction is closed");
  for(let i = 0; i < 101; i++) {
    await ethers.provider.send("evm_mine", []);
}

await expect(NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(50))
  .to.be.revertedWith("Auction is closed");
});
//
  it("should fail to bid if bid is less than the current highest bid", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(120); 
    await MockERC20.mint(signers[2].getAddress(), 200);
    await MockERC20.connect(signers[2]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await expect(NFTDutchAuction_ERC20Bids.connect(signers[2]).bid(100)).to.be.reverted;
  });

  it("should transfer NFT to the highest bidder on auction end", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(120);
    await NFTDutchAuction_ERC20Bids.endAuction();
    expect(await MockERC721.ownerOf(1)).to.equal(await signers[1].getAddress());
  });

it("should allow for price decrement correctly over time", async function() {
    await ethers.provider.send("evm_increaseTime", [numBlocksAuctionOpen]);
    expect(await NFTDutchAuction_ERC20Bids.getCurrentPrice()).to.be.lessThan(startPrice);
});

it("should refund previous highest bid after a new highest bid", async function() {
    await MockERC20.mint(signers[1].getAddress(), 500);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 500);
    await NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(200); // Initial highest bid
    await MockERC20.mint(signers[2].getAddress(), 500);
    await MockERC20.connect(signers[2]).approve(NFTDutchAuction_ERC20Bids.address, 500);
    await NFTDutchAuction_ERC20Bids.connect(signers[2]).bid(300); // New highest bid
    // Initial highest bidder should have been refunded
    expect(await MockERC20.balanceOf(signers[1].getAddress())).to.equal(500);
});

it("should only allow the owner to end the auction", async function() {
    await MockERC20.mint(signers[1].getAddress(), 200);
    await MockERC20.connect(signers[1]).approve(NFTDutchAuction_ERC20Bids.address, 200);
    await NFTDutchAuction_ERC20Bids.connect(signers[1]).bid(120);
    expect(await MockERC20.balanceOf(signers[1].getAddress())).to.equal(80);
    // Try to end the auction as a non-owner
    await expect(NFTDutchAuction_ERC20Bids.connect(signers[1]).endAuction()).to.be.revertedWith("Ownable: caller is not the owner");
    // Try to end the auction as the owner
    await expect(NFTDutchAuction_ERC20Bids.endAuction()).to.not.be.reverted;
});

});