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

import {
	type PreparedWalletTransaction,
	type RecoveryOwner,
	RecoveryOwnerKind,
} from '@snapflow/api-client';
import {
	addOwnerCall,
	SAFE_OWNER_THRESHOLD,
	type SafeCall,
	SafeOperation,
	safeL2Abi,
} from '@snapflow/contracts';
import {
	type Address,
	type DecodeFunctionDataReturnType,
	decodeFunctionData,
	getAddress,
	isAddressEqual,
} from 'viem';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import { SnapflowWalletError } from '../errors/wallet-error.js';
import { preparedFeeBatch } from './wallet-call.js';

const ADD_OWNER_FUNCTION = 'addOwnerWithThreshold';

function refused(reason: string): SnapflowWalletError {
	return new SnapflowWalletError(`${reason}; nothing was signed`);
}

function addedOwner(prepared: PreparedWalletTransaction): Address {
	const [call, ...rest] = preparedFeeBatch(prepared).calls;
	if (
		!call ||
		rest.length > 0 ||
		call.operation !== SafeOperation.CALL ||
		!isAddressEqual(call.to, getAddress(prepared.safeAddress))
	) {
		throw refused('The recovery owner change is not one call on the Safe');
	}
	let decoded: DecodeFunctionDataReturnType<typeof safeL2Abi>;
	try {
		decoded = decodeFunctionData({ abi: safeL2Abi, data: call.data });
	} catch (error) {
		throw new SnapflowWalletError(
			'The recovery owner change is not a Safe call; nothing was signed',
			undefined,
			error
		);
	}
	if (decoded.functionName !== ADD_OWNER_FUNCTION) {
		throw refused(`The recovery owner change calls ${decoded.functionName}`);
	}
	const [owner, threshold] = decoded.args;
	if (threshold !== SAFE_OWNER_THRESHOLD) {
		throw refused('The recovery owner change alters the threshold');
	}
	return owner;
}

export function recoveryOwnerCall(
	prepared: PreparedWalletTransaction,
	owner: RecoveryOwner
): SafeCall {
	const added = addedOwner(prepared);
	if (owner.kind !== RecoveryOwnerKind.Passkey) {
		if (!owner.address) {
			throw new SnapflowValidationError(
				`A ${owner.kind} recovery owner needs its address`
			);
		}
		if (!isAddressEqual(added, getAddress(owner.address))) {
			throw refused('Snapflow prepared another recovery owner');
		}
	}
	return addOwnerCall(getAddress(prepared.safeAddress), added);
}
