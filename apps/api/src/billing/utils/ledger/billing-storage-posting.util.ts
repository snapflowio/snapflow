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
import type { StorageCharge } from '../../entities/storage-charge.entity';
import type { BillingLedgerPosting } from '../../services/ledger/billing-ledger.service';
import {
	customerCreditAccount,
	platformAccount,
} from './billing-ledger-accounts.util';
import { LedgerPostingBuilder } from './ledger-posting-builder.util';

type PostedStorageCharge = Pick<
	StorageCharge,
	'id' | 'organizationId' | 'serviceHour' | 'storedBytes' | 'amountMicroUsd'
>;

export function storagePosting(
	charge: PostedStorageCharge
): BillingLedgerPosting {
	const amount = MicroUsd.parse(charge.amountMicroUsd);
	if (!amount.isPositive()) {
		throw new Error(`Storage charge ${charge.id} has nothing to post`);
	}
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STORAGE_CHARGE,
		descriptionCode: BillingLedgerDescriptionCode.STORAGE_CHARGED,
		sourceReference: charge.id,
		effectiveAt: charge.serviceHour,
		metadata: { storedBytes: charge.storedBytes },
	})
		.debit(customerCreditAccount(charge.organizationId), amount)
		.credit(
			platformAccount(BillingLedgerAccountCode.PLATFORM_SERVICE_REVENUE),
			amount
		)
		.build();
}
