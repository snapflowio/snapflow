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
	VoucherLimit,
	VoucherSigningMode,
} from '@snapflow/api-client';

export const SIGNING_MODE_LABELS = {
	[VoucherSigningMode.Delegated]: 'Delegated',
	[VoucherSigningMode.Client]: 'Client',
} as const satisfies Record<VoucherSigningMode, string>;

export const VOUCHER_LIMIT_LABELS = {
	[VoucherLimit.CustomerBalance]: 'The escrow balance is too low',
	[VoucherLimit.SignerCap]: 'The signer reached its spending limit',
	[VoucherLimit.SignerMissing]: 'No signer is authorized',
	[VoucherLimit.SignerThawing]: 'The signer is stopping',
	[VoucherLimit.SignerRevoked]: 'The signer was revoked',
	[VoucherLimit.SignerExpired]: 'The signer expired',
	[VoucherLimit.SignerScope]: 'The signer scope does not cover this channel',
} as const satisfies Record<VoucherLimit, string>;

const PLATFORM_CHANNEL_LABEL = 'Snapflow storage';
const VOUCHER_CURRENT_LABEL = 'Up to date';

export function paymentChannelSubject(channel: PaymentChannel): string {
	return channel.kind === PaymentChannelKind.Platform
		? PLATFORM_CHANNEL_LABEL
		: (channel.machineId ?? channel.hostAddress);
}

export function paymentChannelUnclaimedMicroUsd(
	channel: PaymentChannel
): string {
	const unclaimed =
		BigInt(channel.signedMicroUsd) - BigInt(channel.claimedMicroUsd);
	return (unclaimed > 0n ? unclaimed : 0n).toString();
}

export function paymentChannelVoucherStatus(channel: PaymentChannel): string {
	return channel.voucherError
		? VOUCHER_LIMIT_LABELS[channel.voucherError]
		: VOUCHER_CURRENT_LABEL;
}
