/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../constants/billing.constants';
import type { PrivatePoolCharge } from '../../entities/private-pool-charge.entity';
import type { BillingLedgerPosting } from '../../services/billing-ledger.service';
import {
	customerCreditAccount,
	platformAccount,
} from './billing-ledger-accounts.util';
import { LedgerPostingBuilder } from './ledger-posting-builder.util';

export type PostedPrivatePoolCharge = Pick<
	PrivatePoolCharge,
	'id' | 'organizationId' | 'machineId' | 'serviceDay' | 'amountMicroUsd'
>;

// A private pool day moves its fee from the organization's credit to
// Snapflow's service revenue, like usage moves a lease's charges; the escrow
// claim of the platform service channel later settles it.
export function privatePoolPosting(
	charge: PostedPrivatePoolCharge
): BillingLedgerPosting {
	const amount = MicroUsd.parse(charge.amountMicroUsd);
	if (!amount.isPositive()) {
		throw new Error(`Private pool charge ${charge.id} has nothing to post`);
	}
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.PRIVATE_POOL_FEE,
		descriptionCode: BillingLedgerDescriptionCode.PRIVATE_POOL_CHARGED,
		sourceReference: charge.id,
		effectiveAt: charge.serviceDay,
		metadata: { machineId: charge.machineId },
	})
		.debit(customerCreditAccount(charge.organizationId), amount)
		.credit(
			platformAccount(BillingLedgerAccountCode.PLATFORM_SERVICE_REVENUE),
			amount
		)
		.build();
}
