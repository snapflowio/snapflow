/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Address, isAddressEqual } from 'viem';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import { VoucherRejection } from '../enums/voucher-rejection.enum';
import {
	type SessionKeyLimits,
	sessionSpendRejection,
} from './session-allowance.util';

export interface SubmittedSignature {
	customerAddress: Address;
	signerAddress: Address;
	recoveredAddress: Address;
	// The customer's key for signerAddress, if it ever set one.
	sessionKey: SessionKeyLimits | null;
	// What the key would be charged with this voucher, see sessionCommitment.
	committedMicroUsd: MicroUsd;
	now: Date;
}

// A voucher is accepted only when the escrow would accept it: signed by the
// claimed signer, which is the customer's funding wallet itself or a session
// key of it that is active and stays within its limits.
export function signatureRejection(
	submitted: SubmittedSignature
): VoucherRejection | null {
	if (!isAddressEqual(submitted.recoveredAddress, submitted.signerAddress)) {
		return VoucherRejection.SIGNATURE_INVALID;
	}
	if (isAddressEqual(submitted.signerAddress, submitted.customerAddress)) {
		return null;
	}
	if (submitted.sessionKey === null) {
		return VoucherRejection.SIGNER_NOT_AUTHORIZED;
	}
	return sessionSpendRejection(
		submitted.sessionKey,
		submitted.committedMicroUsd,
		submitted.now
	);
}
