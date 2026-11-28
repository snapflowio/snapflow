/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ChannelTerms, Voucher } from '@snapflow/contracts';
import type { PaymentChannel } from '../../entities/payment-channel.entity';
import type { PaymentVoucher } from '../../entities/payment-voucher.entity';
import { chainSeconds, microUsd } from '../escrow/escrow-amount.util';

export function channelTerms(
	channel: Pick<
		PaymentChannel,
		'customerAddress' | 'hostAddress' | 'feeReceiverAddress' | 'feeBps' | 'salt'
	>
): ChannelTerms {
	return {
		customer: channel.customerAddress,
		host: channel.hostAddress,
		feeReceiver: channel.feeReceiverAddress,
		feeBps: channel.feeBps,
		salt: channel.salt,
	};
}

export function voucherMessage(
	channel: Parameters<typeof channelTerms>[0],
	voucher: Pick<PaymentVoucher, 'cumulativeMicroUsd' | 'timestamp' | 'metadata'>
): Voucher {
	return {
		...channelTerms(channel),
		cumulativeAmount: microUsd(voucher.cumulativeMicroUsd),
		timestamp: chainSeconds(voucher.timestamp),
		metadata: voucher.metadata,
	};
}
