/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FeeValuesEIP1559 } from 'viem';
import { RELAYER_FEE_BUMP } from '../../constants/settlement.constants';
import { maxBigInt } from './escrow-amount.util';

function bumped(fee: bigint): bigint {
	return (
		(fee * RELAYER_FEE_BUMP.NUMERATOR) / RELAYER_FEE_BUMP.DENOMINATOR +
		RELAYER_FEE_BUMP.MINIMUM_INCREMENT
	);
}

export function replacementFees(
	previous: FeeValuesEIP1559,
	estimate: FeeValuesEIP1559
): FeeValuesEIP1559 {
	const maxPriorityFeePerGas = maxBigInt(
		bumped(previous.maxPriorityFeePerGas),
		estimate.maxPriorityFeePerGas
	);
	return {
		maxPriorityFeePerGas,
		maxFeePerGas: maxBigInt(
			bumped(previous.maxFeePerGas),
			estimate.maxFeePerGas,
			maxPriorityFeePerGas
		),
	};
}

export function replacementFeeCap(initialMaxFeePerGas: string): bigint {
	return BigInt(initialMaxFeePerGas) * RELAYER_FEE_BUMP.MAXIMUM_MULTIPLIER;
}
