/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	activeReservationTotal,
	unpostedCharges,
} from '../../billing/queries/billing-admission.query';
import { ledgerBalance } from '../../billing/queries/ledger-balance.query';
import { customerCreditAccount } from '../../billing/utils/ledger/billing-ledger-accounts.util';
import type { MicroUsd } from '../../common/values/micro-usd.value';

export interface AutoTopUpCandidate {
	organizationId: string;
	thresholdCents: number;
}

export async function autoTopUpCandidates(
	manager: EntityManager,
	attemptedBefore: Date,
	limit: number
): Promise<AutoTopUpCandidate[]> {
	return manager.execute<AutoTopUpCandidate[]>(
		`SELECT policy."organizationId", policy."thresholdCents"
		 FROM "auto_top_up_policy" policy
		 INNER JOIN "organization" organization
			ON organization.id = policy."organizationId"
		 WHERE policy.enabled = true
		   AND policy."suspendedReason" IS NULL
		   AND (policy."lastAttemptAt" IS NULL OR policy."lastAttemptAt" <= ?)
		   AND organization."deletedAt" IS NULL
		   AND organization.suspended = false
		 ORDER BY policy."lastAttemptAt" ASC NULLS FIRST, policy."organizationId" ASC
		 LIMIT ?`,
		[attemptedBefore, limit]
	);
}

export async function spendableCredit(
	manager: EntityManager,
	organizationId: string
): Promise<MicroUsd> {
	const balance = await ledgerBalance(
		manager,
		customerCreditAccount(organizationId)
	);
	const committed = (await unpostedCharges(manager, organizationId)).add(
		await activeReservationTotal(manager, organizationId)
	);
	return balance.subtract(committed).nonnegative();
}
