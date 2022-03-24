const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { arrayify } = require("ethers/lib/utils");

const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

describe("AirDrop", function () {
  const TOKENS_IN_POOL = toWei(1000000000)
  const REWARD_AMOUNT = toWei(500)
  let addrs
  let contractBlocknumber
  const blockNumberCutoff = 11 // Any account that used ethSwap before or including this blocknumber are eligible for airdrop.
  before(async function () {
    // Create an array that shuffles the numbers 0 through 19.
    // The elements of the array will represent the develeopment account number
    // and the index will represent the order in which that account will use ethSwap to buyTokens
    this.shuffle = []
    while (this.shuffle.length < 20) {
      let r = Math.floor(Math.random() * 20)
      if (this.shuffle.indexOf(r) === -1) {
        this.shuffle.push(r)
      }
    }

    // Get all signers
    addrs = await ethers.getSigners();
    // Deploy eth swap
    const EthSwapFactory = await ethers.getContractFactory('EthSwap', addrs[0]);
    this.ethSwap = await EthSwapFactory.deploy();
    const receipt = await this.ethSwap.deployTransaction.wait()
    contractBlocknumber = receipt.blockNumber

    // Instantiate token
    let tokenAddress = await this.ethSwap.token();
    this.token = (
      await ethers.getContractFactory('Token', addrs[0])
    ).attach(tokenAddress);

    // Check that all 1 million tokens are in the pool
    expect(
      await this.token.balanceOf(this.ethSwap.address)
    ).to.equal(TOKENS_IN_POOL);

    // Every development account buys Tokens from the ethSwap exchange in a random order
    await Promise.all(this.shuffle.map(async (i, indx) => {
      const receipt = await (await this.ethSwap.connect(addrs[i]).buyTokens({ value: toWei(10) })).wait() // Each account buys 10,000 tokens worth 10 eth
      expect(receipt.blockNumber).to.eq(indx + 2)
    }))

    // Query all tokensPruchases events between contract block number to block number cut off on the ethSwap contract 
    // to find out all the accounts that have interacted with it
    const filter = this.ethSwap.filters.TokensPurchased()
    const results = await this.ethSwap.queryFilter(filter, contractBlocknumber, blockNumberCutoff)
    expect(results.length).to.eq(blockNumberCutoff - contractBlocknumber)

    // Get elligble addresses from events and then hash them to get leaf nodes
    this.leafNodes = results.map(i => keccak256(i.args.account.toString()))
    // Generate merkleTree from leafNodes
    this.merkleTree = new MerkleTree(this.leafNodes, keccak256, { sortPairs: true });
    // Get root hash from merkle tree
    const rootHash = this.merkleTree.getRoot()
    // Deploy the Air Drop contract
    const AirDropFactory = await ethers.getContractFactory('AirDrop', addrs[0]);
    this.airDrop = await AirDropFactory.deploy(rootHash, REWARD_AMOUNT);

  });

  it("Only eligible accounts should be able to claim airdrop", async function () {
    // Every eligible account claims their airdrop
    for (let i = 0; i < 20; i++) {
      const proof = this.merkleTree.getHexProof(keccak256(addrs[i].address))
      if (proof.length !== 0) {
        await this.airDrop.connect(addrs[i]).claim(proof)
        expect(await this.airDrop.balanceOf(addrs[i].address)).to.eq(REWARD_AMOUNT)
        // Fails when user tries to claim tokens again.
        await expect(this.airDrop.connect(addrs[i]).claim(proof)).to.be.revertedWith("Already claimed air drop")
      } else {
        await expect(this.airDrop.connect(addrs[i]).claim(proof)).to.be.revertedWith("Incorrect merkle proof")
        expect(await this.airDrop.balanceOf(addrs[i].address)).to.eq(0)
      }
    }
  });
});
