// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { ISnapflowEscrowErrors } from "../interfaces/ISnapflowEscrowErrors.sol";
import { ClaimFailure } from "../types/EscrowTypes.sol";

library ClaimFailures {
    uint256 private constant SELECTOR_LENGTH = 4;

    function fromRevert(bytes memory revertData) internal pure returns (ClaimFailure) {
        if (revertData.length < SELECTOR_LENGTH) return ClaimFailure.Other;
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes4 selector = bytes4(revertData);
        if (selector == ISnapflowEscrowErrors.ClaimsAreFrozen.selector) return ClaimFailure.ClaimsFrozen;
        if (selector == ISnapflowEscrowErrors.InvalidVoucherTerms.selector) return ClaimFailure.InvalidVoucherTerms;
        if (selector == ISnapflowEscrowErrors.VoucherFromFuture.selector) return ClaimFailure.VoucherFromFuture;
        if (selector == ISnapflowEscrowErrors.InvalidSignature.selector) return ClaimFailure.InvalidSignature;
        if (selector == ISnapflowEscrowErrors.SignerNotAuthorized.selector) return ClaimFailure.SignerNotAuthorized;
        if (selector == ISnapflowEscrowErrors.SignerExpired.selector) return ClaimFailure.SignerExpired;
        if (selector == ISnapflowEscrowErrors.SignerHostMismatch.selector) return ClaimFailure.SignerHostMismatch;
        if (selector == ISnapflowEscrowErrors.FeeAboveSignerLimit.selector) return ClaimFailure.FeeAboveSignerLimit;
        if (selector == ISnapflowEscrowErrors.CustomerBlockedForVoucher.selector) {
            return ClaimFailure.CustomerBlockedForVoucher;
        }
        if (selector == ISnapflowEscrowErrors.ZeroAmount.selector) return ClaimFailure.ZeroAmount;
        if (selector == ISnapflowEscrowErrors.NothingToClaim.selector) return ClaimFailure.NothingToClaim;
        if (selector == ISnapflowEscrowErrors.InsufficientBalance.selector) return ClaimFailure.InsufficientBalance;
        if (selector == ISnapflowEscrowErrors.SignerCapReached.selector) return ClaimFailure.SignerCapReached;
        return ClaimFailure.Other;
    }
}
