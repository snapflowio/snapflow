/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { LinePrice } from '../../../../marketplace/machine/types/pricing.types';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../constants/billing.constants';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import type { BillingLedgerPosting } from '../../services/billing-ledger.service';
import {
	customerCreditAccount,
	hostPendingEarningsAccount,
	platformAccount,
} from './billing-ledger-accounts.util';
import { LedgerPostingBuilder } from './ledger-posting-builder.util';

export type PostedBillingLine = Pick<
	BillingLineItem,
	| 'id'
	| 'chargeClass'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
	| 'periodEnd'
	| 'sandboxId'
	| 'placementId'
	| 'machineId'
>;

export function usagePosting(
	line: PostedBillingLine,
	charged: LinePrice
): BillingLedgerPosting {
	if (!charged.grossMicroUsd.isPositive()) {
		throw new Error(`Billing line ${line.id} has nothing to post`);
	}
	const posting = LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.LINE_USAGE,
		descriptionCode: BillingLedgerDescriptionCode.USAGE_CHARGED,
		sourceReference: line.id,
		effectiveAt: line.periodEnd,
		metadata: {
			chargeClass: line.chargeClass,
			sandboxId: line.sandboxId,
			placementId: line.placementId,
			machineId: line.machineId,
		},
	}).debit(
		customerCreditAccount(line.customerOrganizationId),
		charged.grossMicroUsd
	);
	if (!line.hostOrganizationId) {
		throw new Error(`Billing line ${line.id} has no host`);
	}
	if (
		!charged.hostMicroUsd
			.add(charged.markupMicroUsd)
			.equals(charged.grossMicroUsd)
	) {
		throw new Error(`Billing line ${line.id} has an unbalanced split`);
	}
	return posting
		.creditIfPositive(
			hostPendingEarningsAccount(line.hostOrganizationId),
			charged.hostMicroUsd
		)
		.creditIfPositive(
			platformAccount(BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE),
			charged.markupMicroUsd
		)
		.build();
}
