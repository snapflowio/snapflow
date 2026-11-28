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
import { MicroUsd } from '../../common/values/micro-usd.value';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import type { EscrowIdentity } from '../types/escrow.types';
import { customerOutstanding } from './customer-outstanding.query';

export interface EscrowFunding {
	walletAddress: Address | null;
	walletReady: boolean;
	freeMicroUsd: MicroUsd;
	pendingWithdrawalMicroUsd: MicroUsd;
	frozenMicroUsd: MicroUsd;
	outstandingMicroUsd: MicroUsd;
	spendableMicroUsd: MicroUsd;
}

export async function escrowFunding(
	manager: EntityManager,
	escrow: EscrowIdentity,
	organizationId: string,
	chainNow: Date
): Promise<EscrowFunding> {
	const [row] = await manager.execute<
		{
			address: Address;
			blocked: boolean;
			free: string;
			pending: string;
			frozen: string;
		}[]
	>(
		`SELECT wallet.address,
			COALESCE(account."blockedUntil" > ?, false) AS blocked,
			COALESCE(account."freeMicroUsd", 0)::text AS free,
			COALESCE(account."pendingMicroUsd", 0)::text AS pending,
			COALESCE(account."frozenMicroUsd", 0)::text AS frozen
		 FROM payment_wallet wallet
		 LEFT JOIN escrow_account account
			ON account."chainId" = ? AND account."contractAddress" = ?
		   AND account.address = wallet.address
		 WHERE wallet."organizationId" = ? AND wallet.purpose = ?`,
		[
			chainNow,
			escrow.chainId,
			escrow.contractAddress,
			organizationId,
			PaymentWalletPurpose.FUNDING,
		]
	);
	if (!row) {
		return {
			walletAddress: null,
			walletReady: false,
			freeMicroUsd: MicroUsd.ZERO,
			pendingWithdrawalMicroUsd: MicroUsd.ZERO,
			frozenMicroUsd: MicroUsd.ZERO,
			outstandingMicroUsd: MicroUsd.ZERO,
			spendableMicroUsd: MicroUsd.ZERO,
		};
	}
	const free = MicroUsd.parse(row.free);
	const outstanding = MicroUsd.of(
		await customerOutstanding(manager, escrow, row.address)
	);
	return {
		walletAddress: row.address,
		walletReady: !row.blocked,
		freeMicroUsd: free,
		pendingWithdrawalMicroUsd: MicroUsd.parse(row.pending),
		frozenMicroUsd: MicroUsd.parse(row.frozen),
		outstandingMicroUsd: outstanding,
		spendableMicroUsd: row.blocked
			? MicroUsd.ZERO
			: free.subtract(outstanding).nonnegative(),
	};
}
