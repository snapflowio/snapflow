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
import { PayoutReadiness } from '../enums/payout-readiness.enum';
import { payoutReadiness } from '../utils/payouts/payout-readiness.util';

export async function readyPayoutWallet(
	manager: EntityManager,
	organizationId: string
): Promise<Address | null> {
	const wallet = await manager.findOne(PaymentWallet, {
		organizationId,
		purpose: PaymentWalletPurpose.PAYOUT,
	});
	return wallet && payoutReadiness(wallet) === PayoutReadiness.READY
		? wallet.address
		: null;
}
