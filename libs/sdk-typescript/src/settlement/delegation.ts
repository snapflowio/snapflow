/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
	DelegatedSignerAuthorization,
	SignerScope as SignerScopeDto,
	VoucherDelegation,
} from '@snapflow/api-client';
import {
	type Address,
	getAddress,
	type Hex,
	isAddress,
	isAddressEqual,
	isHex,
	size,
} from 'viem';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import type { SignerAuthorization, SignerScope } from './escrow-types.js';

const UNSIGNED_INTEGER_PATTERN = /^\d+$/;

function invalid(name: string, value: string): SnapflowValidationError {
	return new SnapflowValidationError(
		`Snapflow returned an invalid ${name}: ${value}`
	);
}

export function unsigned(value: string, name: string): bigint {
	if (!UNSIGNED_INTEGER_PATTERN.test(value)) throw invalid(name, value);
	return BigInt(value);
}

export function hexOfSize(value: string, name: string, bytes?: number): Hex {
	if (!(isHex(value) && (bytes === undefined || size(value) === bytes))) {
		throw invalid(name, value);
	}
	return value;
}

export function addressOf(value: string, name: string): Address {
	if (!isAddress(value, { strict: false })) throw invalid(name, value);
	return getAddress(value);
}

export function signerScopeFrom(scope: SignerScopeDto): SignerScope {
	return {
		hourlyCap: unsigned(scope.hourlyCap, 'hourly cap'),
		expiry: unsigned(scope.expiry, 'expiry'),
		maxFeeBps: scope.maxFeeBps,
		host: addressOf(scope.host, 'signer host'),
	};
}

export function delegatedSignerAuthorizationFrom(
	authorization: DelegatedSignerAuthorization,
	scope: Partial<SignerScope>
): SignerAuthorization {
	return {
		signer: addressOf(authorization.signerAddress, 'signer'),
		scope: { ...signerScopeFrom(authorization.suggestedScope), ...scope },
		proofDeadline: unsigned(authorization.proofDeadline, 'proof deadline'),
		proof: hexOfSize(authorization.proof, 'signer proof'),
	};
}

export function assertDelegationFor(
	delegation: VoucherDelegation,
	escrow: { chainId: number; escrowAddress: Address; account: Address }
): void {
	if (
		delegation.chainId !== escrow.chainId ||
		!isAddressEqual(getAddress(delegation.escrowAddress), escrow.escrowAddress)
	) {
		throw new SnapflowValidationError(
			'Snapflow delegates to another escrow than this one'
		);
	}
	if (
		delegation.fundingWalletAddress === null ||
		!isAddressEqual(getAddress(delegation.fundingWalletAddress), escrow.account)
	) {
		throw new SnapflowValidationError(
			`Link ${escrow.account} as the organization's funding wallet before delegating to Snapflow`
		);
	}
}
