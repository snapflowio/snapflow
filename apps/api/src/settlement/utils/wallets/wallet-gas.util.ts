/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { bytesToHex, type Hex, hexToBytes, maxUint8 } from 'viem';
import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import { ceilDivide } from '../../../common/utils/fixed-point.util';
import { WALLET_GAS } from '../../constants/user-wallet.constants';
import { type GasPricing, gasCostMicroUsd } from '../relay/gas-cost.util';

export function calldataGas(data: Hex): bigint {
	return hexToBytes(data).reduce(
		(gas, byte) =>
			gas +
			(byte === 0
				? WALLET_GAS.CALLDATA_ZERO_BYTE
				: WALLET_GAS.CALLDATA_NONZERO_BYTE),
		0n
	);
}

export function executionGas(estimate: bigint, data: Hex): bigint {
	const execution = estimate - WALLET_GAS.TRANSACTION - calldataGas(data);
	return execution > 0n ? execution : 0n;
}

export function walletFeeCapMicroUsd(
	gasLimit: bigint,
	pricing: GasPricing,
	capBasisPoints: number
): bigint {
	return ceilDivide(
		gasCostMicroUsd(gasLimit, pricing) * BigInt(capBasisPoints),
		BASIS_POINTS_DENOMINATOR
	);
}

export const PLACEHOLDER_SAFE_SIGNATURES: Hex = bytesToHex(
	new Uint8Array(WALLET_GAS.SIGNATURE_BYTES).fill(Number(maxUint8))
);
