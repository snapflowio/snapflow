/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../../common/values/micro-usd.value';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../constants/billing.constants';
import type { BillingLedgerPosting } from '../../services/billing-ledger.service';
import {
	customerCreditAccount,
	hostPendingEarningsAccount,
	platformAccount,
} from './billing-ledger-accounts.util';
import { LedgerPostingBuilder } from './ledger-posting-builder.util';

export interface ForfeitableLine {
	lineId: string;
	customerOrganizationId: string;
	hostOrganizationId: string;
	grossMicroUsd: MicroUsd;
	hostMicroUsd: MicroUsd;
	markupMicroUsd: MicroUsd;
}

export function earningsForfeiturePosting(
	line: ForfeitableLine,
	reviewId: string,
	effectiveAt: Date
): BillingLedgerPosting {
	if (
		!line.grossMicroUsd.isPositive() ||
		!line.hostMicroUsd.add(line.markupMicroUsd).equals(line.grossMicroUsd)
	) {
		throw new Error(`Billing line ${line.lineId} has no forfeitable split`);
	}
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.EARNINGS_FORFEITURE,
		descriptionCode: BillingLedgerDescriptionCode.EARNINGS_FORFEITED,
		sourceReference: line.lineId,
		effectiveAt,
		metadata: { reviewId },
	})
		.debitIfPositive(
			hostPendingEarningsAccount(line.hostOrganizationId),
			line.hostMicroUsd
		)
		.debitIfPositive(
			platformAccount(BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE),
			line.markupMicroUsd
		)
		.creditIfPositive(
			customerCreditAccount(line.customerOrganizationId),
			line.grossMicroUsd
		)
		.build();
}
