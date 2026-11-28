/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PaymentChannel } from '../../entities/payment-channel.entity';
import type { PaymentChannelCharge } from '../../entities/payment-channel-charge.entity';
import { PaymentChannelKind } from '../../enums/payment-channel-kind.enum';
import { maxBigInt, microUsd } from '../escrow/escrow-amount.util';

export function accountedCharge(
	channel: Pick<PaymentChannel, 'refundedMicroUsd'>,
	charges: readonly Pick<PaymentChannelCharge, 'chargedMicroUsd'>[]
): bigint {
	return charges.reduce(
		(total, charge) => total + microUsd(charge.chargedMicroUsd),
		microUsd(channel.refundedMicroUsd)
	);
}

export function boundCharge(
	accounted: bigint,
	channel: Pick<PaymentChannel, 'signedMicroUsd'>
): bigint {
	return maxBigInt(accounted, microUsd(channel.signedMicroUsd));
}

export function refundDue(
	channel: Pick<
		PaymentChannel,
		'kind' | 'chargedMicroUsd' | 'refundedMicroUsd'
	>,
	charges: readonly Pick<PaymentChannelCharge, 'chargedMicroUsd'>[]
): bigint {
	if (channel.kind !== PaymentChannelKind.SANDBOX) return 0n;
	return maxBigInt(
		0n,
		microUsd(channel.chargedMicroUsd) - accountedCharge(channel, charges)
	);
}
