/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../../../billing/ledger/constants/billing.constants';
import type { BillingLedgerPosting } from '../../../../billing/ledger/services/billing-ledger.service';
import {
	hostPendingEarningsAccount,
	providerEarningsAccount,
} from '../../../../billing/ledger/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../../billing/ledger/utils/ledger/ledger-posting-builder.util';
import type { MicroUsd } from '../../../../common/values/micro-usd.value';
import { assertPositive } from './posting-guard.util';

export interface EarningsMaturityPostingInput {
	lineId: string;
	hostOrganizationId: string;
	amountMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function earningsMaturityPosting(
	input: EarningsMaturityPostingInput
): BillingLedgerPosting {
	assertPositive('Earnings maturity', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.EARNINGS_MATURITY,
		descriptionCode: BillingLedgerDescriptionCode.EARNINGS_MATURED,
		sourceReference: input.lineId,
		effectiveAt: input.effectiveAt,
		metadata: { hostOrganizationId: input.hostOrganizationId },
	})
		.debit(
			hostPendingEarningsAccount(input.hostOrganizationId),
			input.amountMicroUsd
		)
		.credit(
			providerEarningsAccount(input.hostOrganizationId),
			input.amountMicroUsd
		)
		.build();
}
