// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { ECDSA } from "@openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import { EscrowHashing } from "../libraries/EscrowHashing.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { SignerBudget } from "../libraries/SignerBudget.sol";
import { SignerGrant, SignerScope, Voucher } from "../types/EscrowTypes.sol";
import { EscrowCompliance } from "./EscrowCompliance.sol";
import { EscrowPause } from "./EscrowPause.sol";

abstract contract EscrowSigners is EscrowCompliance, EscrowPause {
    mapping(address signer => SignerGrant) private _signers;

    function authorizeSigner(
        address signer,
        SignerScope calldata scope,
        uint256 proofDeadline,
        bytes calldata proof
    )
        external
        whenNotPaused
    {
        if (signer == address(0) || signer == msg.sender) revert InvalidSigner(signer);
        _requireNotBlocked(msg.sender);
        _requireNotBlocked(signer);
        SignerGrant storage grant = _signers[signer];
        address bound = grant.customer;
        if (bound != address(0)) revert SignerAlreadyBound(signer, bound);
        if (scope.hourlyCap == 0 || scope.expiry <= block.timestamp || scope.maxFeeBps > EscrowLimits.MAX_FEE_BPS) {
            revert InvalidSignerScope();
        }
        if (proofDeadline <= block.timestamp) revert SignerProofExpired(proofDeadline);
        if (!_isSignedBy(signer, EscrowHashing.signerProofDigest(address(this), proofDeadline, msg.sender), proof)) {
            revert InvalidSignerProof(signer);
        }

        grant.customer = msg.sender;
        grant.expiry = scope.expiry;
        grant.maxFeeBps = scope.maxFeeBps;
        grant.hourlyCap = scope.hourlyCap;
        grant.updatedAt = unfrozenTime();
        grant.freezeOffset = _frozenSeconds();
        grant.host = scope.host;
        emit SignerAuthorized(msg.sender, signer, scope.hourlyCap, scope.expiry, scope.maxFeeBps, scope.host);
    }

    function raiseSignerLimit(address signer, uint96 hourlyCap, uint64 expiry) external whenNotPaused {
        _requireNotBlocked(msg.sender);
        SignerGrant memory grant = _refilledOwnGrant(signer);
        if (grant.thawEnd != 0) revert SignerAlreadyThawing(signer, grant.thawEnd);
        if (
            hourlyCap < grant.hourlyCap || expiry < grant.expiry
                || (hourlyCap == grant.hourlyCap && expiry == grant.expiry)
        ) revert InvalidSignerScope();
        grant.hourlyCap = hourlyCap;
        grant.expiry = expiry;
        grant.pendingHourlyCap = 0;
        grant.pendingEffectiveAt = 0;
        _storeGrant(signer, grant);
        emit SignerLimitRaised(msg.sender, signer, hourlyCap, expiry);
    }

    function lowerSignerLimit(address signer, uint96 hourlyCap) external {
        SignerGrant memory grant = _refilledOwnGrant(signer);
        if (hourlyCap == 0 || hourlyCap >= grant.hourlyCap) revert InvalidSignerScope();
        uint64 effectiveAt = unfrozenTime() + signerThawPeriod;
        grant.pendingHourlyCap = hourlyCap;
        grant.pendingEffectiveAt = effectiveAt;
        _storeGrant(signer, grant);
        emit SignerLimitLowerScheduled(msg.sender, signer, hourlyCap, effectiveAt);
    }

    function thawSigner(address signer) external {
        SignerGrant storage grant = _ownGrant(signer);
        if (grant.thawEnd != 0) revert SignerAlreadyThawing(signer, grant.thawEnd);
        uint64 thawEnd = unfrozenTime() + signerThawPeriod;
        grant.thawEnd = thawEnd;
        emit SignerThawed(msg.sender, signer, thawEnd);
    }

    function revokeSigner(address signer) external {
        SignerGrant storage grant = _ownGrant(signer);
        uint64 thawEnd = grant.thawEnd;
        if (thawEnd == 0) revert SignerNotThawing(signer);
        if (unfrozenTime() < thawEnd) revert SignerStillThawing(signer, thawEnd);
        grant.revoked = true;
        emit SignerRevoked(msg.sender, signer);
    }

    function signerOf(address signer) external view returns (SignerGrant memory) {
        return _signers[signer];
    }

    function _authorizeVoucherSigner(
        address signer,
        Voucher calldata voucher,
        bytes32 digest,
        bytes calldata signature
    )
        internal
        returns (uint256 remaining)
    {
        address customer = voucher.customer;
        if (signer == customer) {
            if (!_isSignedBy(customer, digest, signature)) revert InvalidSignature(signer);
            return type(uint256).max;
        }
        SignerGrant memory grant = _signers[signer];
        if (grant.customer != customer || grant.revoked) revert SignerNotAuthorized(signer);
        if (!_isSignedBy(signer, digest, signature)) revert InvalidSignature(signer);
        uint64 now_ = unfrozenTime();
        uint64 expiry = grant.expiry;
        if (voucher.timestamp >= expiry || now_ >= expiry - grant.freezeOffset + claimWindow) {
            revert SignerExpired(signer);
        }
        address restrictedTo = grant.host;
        if (restrictedTo != address(0) && restrictedTo != voucher.host) {
            revert SignerHostMismatch(signer, voucher.host);
        }
        uint16 maxFeeBps = grant.maxFeeBps;
        if (voucher.feeBps > maxFeeBps) revert FeeAboveSignerLimit(voucher.feeBps, maxFeeBps);

        SignerBudget.refill(grant, now_);
        _storeGrant(signer, grant);
        return grant.available;
    }

    function _chargeSigner(address signer, uint128 amount) internal {
        _signers[signer].available -= amount;
    }

    function _storeGrant(address signer, SignerGrant memory grant) private {
        _signers[signer] = grant;
    }

    function _ownGrant(address signer) private view returns (SignerGrant storage grant) {
        grant = _signers[signer];
        if (grant.customer != msg.sender) revert NotAuthorized(msg.sender);
        if (grant.revoked) revert SignerNotAuthorized(signer);
    }

    function _refilledOwnGrant(address signer) private view returns (SignerGrant memory grant) {
        grant = _ownGrant(signer);
        SignerBudget.refill(grant, unfrozenTime());
    }

    function _isSignedBy(address signer, bytes32 digest, bytes calldata signature) private pure returns (bool) {
        // slither-disable-next-line unused-return
        (address recovered, ECDSA.RecoverError recoverError,) = ECDSA.tryRecoverCalldata(digest, signature);
        return recoverError == ECDSA.RecoverError.NoError && recovered == signer;
    }
}
