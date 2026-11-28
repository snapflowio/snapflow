/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../../billing/constants/billing.constants';
import { RECEIPT_TRANSACTION_HASH_METADATA_KEY } from '../../../billing/constants/billing-receipt.constants';
import type { BillingLedgerPosting } from '../../../billing/services/ledger/billing-ledger.service';
import {
	customerCreditAccount,
	platformAccount,
} from '../../../billing/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../billing/utils/ledger/ledger-posting-builder.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { PaymentChannel } from '../../entities/payment-channel.entity';
import type { PaymentChannelRefund } from '../../entities/payment-channel-refund.entity';

export function channelRefundPosting(
	channel: Pick<PaymentChannel, 'customerOrganizationId'>,
	refund: PaymentChannelRefund
): BillingLedgerPosting {
	const amount = MicroUsd.parse(refund.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.PAYMENT_CHANNEL_REFUND,
		descriptionCode: BillingLedgerDescriptionCode.PAYMENT_CHANNEL_REFUNDED,
		sourceReference: refund.id,
		effectiveAt: refund.refundedAt,
		metadata: {
			paymentChannelId: refund.paymentChannelId,
			[RECEIPT_TRANSACTION_HASH_METADATA_KEY]: refund.transactionHash,
		},
	})
		.debit(customerCreditAccount(channel.customerOrganizationId), amount)
		.credit(platformAccount(BillingLedgerAccountCode.PLATFORM_WALLET), amount)
		.build();
}
