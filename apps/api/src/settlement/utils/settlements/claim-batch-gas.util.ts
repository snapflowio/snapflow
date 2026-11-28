/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { batchItemsGas } from '@snapflow/contracts';
import type { Hex } from 'viem';
import { WALLET_GAS } from '../../constants/user-wallet.constants';
import { calldataGas } from '../wallets/wallet-gas.util';

export function claimBatchGasFloor(
	data: Hex,
	items: number,
	overhead: bigint
): bigint {
	return (
		WALLET_GAS.TRANSACTION + calldataGas(data) + overhead + batchItemsGas(items)
	);
}
