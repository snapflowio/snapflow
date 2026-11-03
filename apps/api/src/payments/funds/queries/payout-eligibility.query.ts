/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { PaymentAccountTransfersStatus } from '../enums/payment-account-status.enum';
import { PayoutState } from '../enums/payout-state.enum';
import { PAYOUT_ELIGIBLE_REQUIREMENTS } from '../utils/payout.util';

export interface PayoutCandidate {
	organizationId: string;
	stripeAccountId: string;
}

export function payoutCandidates(
	manager: EntityManager,
	afterOrganizationId: string | null,
	limit: number
): Promise<PayoutCandidate[]> {
	return manager.execute<PayoutCandidate[]>(
		`SELECT account."organizationId", account."stripeAccountId"
		 FROM "payment_account" account
		 INNER JOIN "organization" organization
			ON organization.id = account."organizationId"
		 WHERE account."transfersStatus" = ?
		   AND account."requirementsStatus" IN (?)
		   AND account."payoutsBlockedReason" IS NULL
		   AND organization."deletedAt" IS NULL
		   AND (
			organization.suspended = false
			OR organization."suspendedUntil" <= CURRENT_TIMESTAMP
		   )
		   AND NOT EXISTS (
			SELECT 1 FROM "payout" payout
			WHERE payout."organizationId" = account."organizationId"
			  AND payout.state = ?
		   )
		   AND (?::uuid IS NULL OR account."organizationId" > ?::uuid)
		 ORDER BY account."organizationId" ASC
		 LIMIT ?`,
		[
			PaymentAccountTransfersStatus.ACTIVE,
			PAYOUT_ELIGIBLE_REQUIREMENTS,
			PayoutState.PENDING,
			afterOrganizationId,
			afterOrganizationId,
			limit,
		]
	);
}
