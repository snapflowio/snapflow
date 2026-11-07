/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import type { PayoutReadiness } from '../enums/payout-readiness.enum';
import { payoutReadiness } from '../utils/payout-readiness.util';

@Injectable()
export class PayoutReadinessService {
	constructor(private readonly entityManager: EntityManager) {}

	async forOrganization(
		organizationId: string,
		manager: EntityManager = this.entityManager
	): Promise<PayoutReadiness> {
		return payoutReadiness(
			await manager.findOne(PaymentWallet, {
				organizationId,
				purpose: PaymentWalletPurpose.PAYOUT,
			})
		);
	}
}
