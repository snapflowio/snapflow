/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import type { EscrowIdentity } from '../types/escrow.types';

export interface EscrowFunding {
	// A linked funding wallet the escrow has not blocked.
	walletReady: boolean;
	pendingWithdrawalMicroUsd: MicroUsd;
}

export async function escrowFunding(
	manager: EntityManager,
	escrow: EscrowIdentity,
	organizationId: string
): Promise<EscrowFunding> {
	const wallet = await manager.findOne(
		PaymentWallet,
		{ organizationId, purpose: PaymentWalletPurpose.FUNDING },
		{ fields: ['address'] }
	);
	if (!wallet) {
		return { walletReady: false, pendingWithdrawalMicroUsd: MicroUsd.ZERO };
	}
	const account = await manager.findOne(
		EscrowAccount,
		{ ...escrow, address: wallet.address },
		{ fields: ['blocked', 'pendingWithdrawalMicroUsd'] }
	);
	return {
		walletReady: !account?.blocked,
		pendingWithdrawalMicroUsd: account
			? MicroUsd.parse(account.pendingWithdrawalMicroUsd)
			: MicroUsd.ZERO,
	};
}
