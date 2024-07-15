// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {EVMFetcher} from "linea-state-verifier/contracts/EVMFetcher.sol";
import {EVMFetchTarget} from "linea-state-verifier/contracts/EVMFetchTarget.sol";
import {IEVMVerifier} from "linea-state-verifier/contracts/IEVMVerifier.sol";

contract TestL1 is EVMFetchTarget {
    using EVMFetcher for EVMFetcher.EVMFetchRequest;

    uint256 constant L2_BLOCK_RANGE_ACCEPTED = 96400;

    IEVMVerifier verifier; // Slot 0
    address target;

    constructor(IEVMVerifier _verifier, address _target) {
        verifier = _verifier;
        target = _target;
    }

    function getLatest() public view returns (uint256) {
        EVMFetcher.newFetchRequest(verifier, target).getStatic(0).fetch(
            this.getLatestCallback.selector,
            abi.encode(L2_BLOCK_RANGE_ACCEPTED)
        );
    }

    function getLatestCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (uint256) {
        return abi.decode(values[0], (uint256));
    }

    function getName() public view returns (string memory) {
        EVMFetcher.newFetchRequest(verifier, target).getDynamic(1).fetch(
            this.getNameCallback.selector,
            abi.encode(L2_BLOCK_RANGE_ACCEPTED)
        );
    }

    function getNameCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (string memory) {
        return string(values[0]);
    }

    function getHighscorer(uint256 idx) public view returns (string memory) {
        EVMFetcher
            .newFetchRequest(verifier, target)
            .getDynamic(3)
            .element(idx)
            .fetch(
                this.getHighscorerCallback.selector,
                abi.encode(L2_BLOCK_RANGE_ACCEPTED)
            );
    }

    function getHighscorerCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (string memory) {
        return string(values[0]);
    }

    function getLatestHighscore() public view returns (uint256) {
        EVMFetcher
            .newFetchRequest(verifier, target)
            .getStatic(0)
            .getStatic(2)
            .ref(0)
            .fetch(
                this.getLatestHighscoreCallback.selector,
                abi.encode(L2_BLOCK_RANGE_ACCEPTED)
            );
    }

    function getLatestHighscoreCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (uint256) {
        return abi.decode(values[1], (uint256));
    }

    function getLatestHighscorer() public view returns (string memory) {
        EVMFetcher
            .newFetchRequest(verifier, target)
            .getStatic(0)
            .getDynamic(3)
            .ref(0)
            .fetch(
                this.getLatestHighscorerCallback.selector,
                abi.encode(L2_BLOCK_RANGE_ACCEPTED)
            );
    }

    function getLatestHighscorerCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (string memory) {
        return string(values[1]);
    }

    function getNickname(
        string memory _name
    ) public view returns (string memory) {
        EVMFetcher
            .newFetchRequest(verifier, target)
            .getDynamic(4)
            .element(_name)
            .fetch(
                this.getNicknameCallback.selector,
                abi.encode(L2_BLOCK_RANGE_ACCEPTED)
            );
    }

    function getNicknameCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (string memory) {
        return string(values[0]);
    }

    function getPrimaryNickname() public view returns (string memory) {
        EVMFetcher
            .newFetchRequest(verifier, target)
            .getDynamic(1)
            .getDynamic(4)
            .ref(0)
            .fetch(
                this.getPrimaryNicknameCallback.selector,
                abi.encode(L2_BLOCK_RANGE_ACCEPTED)
            );
    }

    function getPrimaryNicknameCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (string memory) {
        return string(values[1]);
    }

    function getZero() public view returns (uint256) {
        EVMFetcher.newFetchRequest(verifier, target).getStatic(5).fetch(
            this.getZeroCallback.selector,
            abi.encode(L2_BLOCK_RANGE_ACCEPTED)
        );
    }

    function getZeroCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (uint256) {
        return abi.decode(values[0], (uint256));
    }

    function getZeroIndex() public view returns (uint256) {
        EVMFetcher
            .newFetchRequest(verifier, target)
            .getStatic(5)
            .getStatic(2)
            .ref(0)
            .fetch(
                this.getZeroIndexCallback.selector,
                abi.encode(L2_BLOCK_RANGE_ACCEPTED)
            );
    }

    function getZeroIndexCallback(
        bytes[] memory values,
        bytes memory
    ) public pure returns (uint256) {
        return abi.decode(values[1], (uint256));
    }
}
