/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type BillingPeriod,
	utcBillingMonth,
} from '../../billing/utils/billing-period.util';
import { formatStatementMonth } from '../../billing/utils/billing-statement.util';
import { PLATFORM_SERVICE_CHANNEL_PREFIX } from '../constants/payment-channel.constants';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';

type KindColumns = Pick<
	PaymentChannel,
	| 'kind'
	| 'channelId'
	| 'leaseId'
	| 'sandboxId'
	| 'machineId'
	| 'hostOrganizationId'
	| 'servicePeriodStart'
>;

export interface ChannelLease {
	leaseId: string;
	sandboxId: string;
	machineId: string;
	hostOrganizationId: string;
}

// The lease a lease channel pays for, or null for a platform service channel.
export function channelLease(channel: KindColumns): ChannelLease | null {
	if (channel.kind !== PaymentChannelKind.LEASE) return null;
	const { leaseId, sandboxId, machineId, hostOrganizationId } = channel;
	if (
		leaseId === null ||
		sandboxId === null ||
		machineId === null ||
		hostOrganizationId === null
	) {
		throw new Error(`Lease channel ${channel.channelId} has no lease`);
	}
	return { leaseId, sandboxId, machineId, hostOrganizationId };
}

// The month a platform service channel bills, or null for a lease channel.
export function channelServicePeriod(
	channel: KindColumns
): BillingPeriod | null {
	if (channel.kind !== PaymentChannelKind.PLATFORM_SERVICE) return null;
	if (channel.servicePeriodStart === null) {
		throw new Error(
			`Platform service channel ${channel.channelId} has no service period`
		);
	}
	return utcBillingMonth(channel.servicePeriodStart);
}

// What a platform service channel's id is derived from in place of a lease
// id: one channel per customer organization and month.
export function platformServiceReference(
	organizationId: string,
	period: BillingPeriod
): string {
	return `${PLATFORM_SERVICE_CHANNEL_PREFIX}:${organizationId}:${formatStatementMonth(period.start)}`;
}
