/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { BillingLineItem } from '../../billing/entities/billing-line-item.entity';
import { usagePeriodCharge } from '../../billing/utils/usage-period-charge.util';
import type { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import type { PriceTerms } from '../../marketplace/types/pricing.types';
import { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import type { LeaseCharges } from '../types/payment-channel.types';

// Every billing line of the lease, posted or not, and what its open usage
// periods accrued until observedAt. The placement and sandbox narrow both
// lookups to their indexes; a lease never outlives either.
export async function leaseCharges(
	manager: EntityManager,
	lease: Pick<SandboxLease, 'id' | 'sandboxId' | 'placementId'>,
	terms: PriceTerms,
	observedAt: Date
): Promise<LeaseCharges> {
	const lines = await manager.find(
		BillingLineItem,
		{ placementId: lease.placementId, leaseId: lease.id },
		{
			fields: [
				'beneficiaryKind',
				'grossMicroUsd',
				'hostMicroUsd',
				'markupMicroUsd',
			],
		}
	);
	const openPeriods = await manager.find(
		SandboxUsagePeriod,
		{ sandboxId: lease.sandboxId, leaseId: lease.id, endAt: null },
		{ fields: ['mode', 'startAt', 'cpu', 'mem', 'disk', 'gpu'] }
	);
	return {
		lines,
		accruals: openPeriods.map((period) =>
			usagePeriodCharge(terms, period, observedAt)
		),
	};
}
