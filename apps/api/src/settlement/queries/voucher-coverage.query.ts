/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { voucherCoverageLapsed } from '../utils/voucher-schedule.util';

// True when the lease's open channel went longer than the grace intervals
// without a signed voucher covering what it owed. Leases without a channel
// (self-use) never lapse.
export async function leaseVoucherCoverageLapsed(
	manager: EntityManager,
	leaseId: string,
	observedAt: Date,
	settings: Pick<
		SettingsSnapshot,
		'voucherIntervalSeconds' | 'voucherGraceIntervals'
	>
): Promise<boolean> {
	const channel = await manager.findOne(
		PaymentChannel,
		{ leaseId, state: PaymentChannelState.OPEN },
		{ fields: ['coveredAt'] }
	);
	return (
		channel !== null &&
		voucherCoverageLapsed(channel.coveredAt, observedAt, settings)
	);
}
