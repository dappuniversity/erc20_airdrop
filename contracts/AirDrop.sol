// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract AirDrop is ERC20("AirDrop", "AD") {
    bytes32 public immutable root;
    uint256 public immutable rewardAmount;
    mapping(address => bool) claimed;

    EthSwap public ethSwap;

    constructor(bytes32 _root, uint256 _rewardAmount, address _ethSwap) {
        root = _root;
        rewardAmount = _rewardAmount;
        ethSwap = EthSwap(_ethSwap);
    }

    function claim(bytes32[] calldata _proof) external {
        require(!claimed[msg.sender], "Already claimed air drop");
        claimed[msg.sender] = true;
        bytes32 _leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(_proof, root, _leaf),
            "Incorrect merkle proof"
        );
        ethSwap.transferRewardTokens(msg.sender, rewardAmount);
    }
}
