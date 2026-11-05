/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, QueryOrder } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { addMilliseconds } from '../../common/utils/time.util';
import { CHANNEL_SETTLE_DELAY_MILLISECONDS } from '../constants/payment-channel.constants';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';

// Channels that still run, or closed recently enough that their final
// voucher may not have expired yet.
export function recentChannels(
	manager: EntityManager,
	where: FilterQuery<PaymentChannel>,
	now: Date,
	voucherLifetimeHours: number
): Promise<PaymentChannel[]> {
	const closedSince = addMilliseconds(
		now,
		-(
			voucherLifetimeHours * MILLISECONDS_PER_HOUR +
			CHANNEL_SETTLE_DELAY_MILLISECONDS
		)
	);
	return manager.find(
		PaymentChannel,
		{
			$and: [
				where,
				{
					$or: [
						{ state: { $ne: PaymentChannelState.CLOSED } },
						{ closedAt: { $gt: closedSince } },
					],
				},
			],
		},
		{ orderBy: { channelId: QueryOrder.ASC } }
	);
}
