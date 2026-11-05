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
import { PaymentAccount } from '../../../payments/entities/payment-account.entity';
import type { PayoutReadiness } from '../../../payments/enums/payout-readiness.enum';
import { payoutReadiness } from '../../../payments/utils/payout-readiness.util';

@Injectable()
export class MachinePayoutReadinessService {
	constructor(private readonly entityManager: EntityManager) {}

	async forOrganization(organizationId: string): Promise<PayoutReadiness> {
		const account = await this.entityManager.findOne(PaymentAccount, {
			organizationId,
		});
		return payoutReadiness(account);
	}
}
