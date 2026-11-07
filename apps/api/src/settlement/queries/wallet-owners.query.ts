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

export type WalletOwners = Readonly<
	Record<PaymentWalletPurpose, ReadonlyMap<Address, string>>
>;

// The organizations that currently link each address, per wallet purpose.
export async function walletOwners(
	manager: EntityManager,
	addresses: readonly Address[]
): Promise<WalletOwners> {
	const owners = {
		[PaymentWalletPurpose.FUNDING]: new Map<Address, string>(),
		[PaymentWalletPurpose.PAYOUT]: new Map<Address, string>(),
	};
	if (addresses.length === 0) return owners;
	const wallets = await manager.find(
		PaymentWallet,
		{ address: { $in: [...new Set(addresses)] } },
		{ fields: ['organizationId', 'purpose', 'address'] }
	);
	for (const wallet of wallets) {
		owners[wallet.purpose].set(wallet.address, wallet.organizationId);
	}
	return owners;
}
