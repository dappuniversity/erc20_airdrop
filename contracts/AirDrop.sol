// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract AirDrop is ERC20("AirDrop", "AD") {
    bytes32 public immutable root;
    uint256 public immutable rewardAmount;
    mapping(address => bool) claimed;

    constructor(bytes32 _root, uint256 _rewardAmount) {
        root = _root;
        rewardAmount = _rewardAmount;
    }

    function claim(bytes32[] calldata _proof) external {
        require(!claimed[msg.sender], "Already claimed air drop");
        claimed[msg.sender] = true;
        bytes32 _leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(_proof, root, _leaf),
            "Incorrect merkle proof"
        );
        _mint(msg.sender, rewardAmount);
    }
}
