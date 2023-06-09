// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTDutchAuction_ERC20Bids is Ownable {
    IERC721 public nftToken;
    IERC20 public bidToken;
    uint256 public nftTokenId;
    uint256 public reservePrice;
    uint256 public numBlocksAuctionOpen;
    uint256 public auctionDuration;
    uint256 public offerPriceDecrement;
    uint256 public highestBid;
    uint256 public startPrice;
    uint256 public startBlock;
    address public bids;
    address public highestBidder;
    bool public auctionEnded;

    // Events for better frontend interaction
    event BidRefunded(address indexed refundedBidder, uint256 amount);
    event AuctionStarted(uint256 startPrice);
    event NewBid(address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed winner, uint256 winningBid);

    constructor (
        address erc20TokenAddress,
        address erc721TokenAddress,
        uint256 _nftTokenId,
        uint256 _reservePrice,
        uint256 _numBlocksAuctionOpen,
        uint256 _offerPriceDecrement
        
    ){
        require(_reservePrice > 0, "Reserve price should be greater than 0");
        require(_offerPriceDecrement > 0, "Offer price decrement should be greater than 0");
        require(_numBlocksAuctionOpen > 0, "Auction must be open for at least one block");

        nftToken = IERC721(erc721TokenAddress);
        bidToken = IERC20(erc20TokenAddress);
        nftTokenId = _nftTokenId;
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        startPrice = reservePrice + numBlocksAuctionOpen * offerPriceDecrement;
        startBlock = block.number;
        auctionEnded = false;

        emit AuctionStarted(startPrice);
    }

    function getCurrentPrice() public view returns (uint256) {
        if (block.number > startBlock) {
            uint256 priceDrop = offerPriceDecrement * (block.number - startBlock);
            return startPrice > priceDrop ? startPrice - priceDrop : reservePrice;
        } else {
            return startPrice;          
        }
    }
    function getCurrentBlockNumber() public view returns (uint) {
    return block.number;
}

    
    function bid(uint256 amount) external {
        
        require(!auctionEnded, "Auction has ended");
    //      require(!auctionClosed, "Auction is closed");
    // require(_bidAmount >= reservePrice, "Bid is lower than the reserve price");
        require(block.number <= startBlock + numBlocksAuctionOpen, "Auction is closed");
        require(amount >= getCurrentPrice(), "Bid is lower than the reserve price");
        require(msg.sender != owner(), "Owner cannot place a bid");

        uint256 allowance = bidToken.allowance(msg.sender, address(this));
        require(allowance >= amount, "Check the token allowance");

        // If there's a previous bid, refund it
        if (highestBidder != address(0)) {
            bidToken.transfer(highestBidder, highestBid);
            emit BidRefunded(highestBidder, highestBid);
        }

        // Update new highest bidder
        bidToken.transferFrom(msg.sender, address(this), amount);
        
        highestBid = amount;
        highestBidder = msg.sender;

        emit NewBid(msg.sender, amount);
    }


    function endAuction() public onlyOwner{

        require(!auctionEnded, "Auction has already ended");
        
        require(highestBidder != address(0), "No bids received");
        // Transfer the funds to the seller
        bidToken.transfer(owner(), highestBid);
        // Transfer the NFT to the highest bidder
        nftToken.transferFrom(owner(), highestBidder, nftTokenId);
        auctionEnded = true;
        emit AuctionEnded(highestBidder, highestBid);
    }
}
