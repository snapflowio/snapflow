/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type PaymentChannel,
	PaymentChannelKind,
	type VoucherMessage,
	VoucherSigningMode,
} from '@snapflow/api-client';
import { formatStatementMonth } from './format.ts';

const MONTH_PREFIX_LENGTH = 'YYYY-MM'.length;

export const SIGNING_MODE_LABELS = {
	[VoucherSigningMode.Delegated]: 'Delegated',
	[VoucherSigningMode.Client]: 'Client',
} as const satisfies Record<VoucherSigningMode, string>;

export function paymentChannelSubject(channel: PaymentChannel): string {
	if (channel.kind === PaymentChannelKind.Lease) {
		return channel.sandboxId ?? channel.channelId;
	}
	return channel.servicePeriodStart
		? `Private pool · ${formatStatementMonth(channel.servicePeriodStart.slice(0, MONTH_PREFIX_LENGTH))}`
		: 'Private pool';
}

export function voucherTotalMicroUsd(message: VoucherMessage): string {
	return (
		BigInt(message.hostAmount) +
		BigInt(message.feeAmount) +
		BigInt(message.serviceAmount)
	).toString();
}

export function paymentChannelIssue(channel: PaymentChannel): string | null {
	return channel.voucherError ?? channel.claimError;
}
