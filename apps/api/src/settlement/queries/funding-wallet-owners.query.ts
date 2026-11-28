/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Address } from 'viem';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';

export async function fundingWalletOwners(
	manager: EntityManager,
	addresses: readonly Address[]
): Promise<Map<Address, string>> {
	if (addresses.length === 0) return new Map();
	const wallets = await manager.find(
		PaymentWallet,
		{
			purpose: PaymentWalletPurpose.FUNDING,
			address: { $in: [...new Set(addresses)] },
		},
		{ fields: ['organizationId', 'address'] }
	);
	return new Map(
		wallets.map((wallet) => [wallet.address, wallet.organizationId])
	);
}
