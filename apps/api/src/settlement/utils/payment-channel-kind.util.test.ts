/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { utcBillingMonth } from '../../billing/utils/billing-period.util';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import { CHANNEL_ID } from '../testing/escrow-log.fixtures';
import {
	channelLease,
	channelServicePeriod,
	platformServiceReference,
} from './payment-channel-kind.util';

const LEASE = {
	leaseId: 'lease-id',
	sandboxId: 'sandbox-id',
	machineId: 'machine-id',
	hostOrganizationId: 'host-organization',
};
const LEASE_CHANNEL = {
	kind: PaymentChannelKind.LEASE,
	channelId: CHANNEL_ID,
	...LEASE,
	servicePeriodStart: null,
};
const PERIOD_START = new Date('2026-11-01T00:00:00.000Z');
const SERVICE_CHANNEL = {
	kind: PaymentChannelKind.PLATFORM_SERVICE,
	channelId: CHANNEL_ID,
	leaseId: null,
	sandboxId: null,
	machineId: null,
	hostOrganizationId: null,
	servicePeriodStart: PERIOD_START,
};

describe('payment channel kinds', () => {
	it('gives a lease channel its lease and no service period', () => {
		assert.deepEqual(channelLease(LEASE_CHANNEL), LEASE);
		assert.equal(channelServicePeriod(LEASE_CHANNEL), null);
	});

	it('gives a platform service channel its month and no lease', () => {
		assert.equal(channelLease(SERVICE_CHANNEL), null);
		assert.deepEqual(
			channelServicePeriod(SERVICE_CHANNEL),
			utcBillingMonth(PERIOD_START)
		);
	});

	it('refuses a channel whose columns contradict its kind', () => {
		assert.throws(() => channelLease({ ...LEASE_CHANNEL, leaseId: null }));
		assert.throws(() =>
			channelServicePeriod({ ...SERVICE_CHANNEL, servicePeriodStart: null })
		);
	});

	it('derives one channel reference per organization and month', () => {
		assert.equal(
			platformServiceReference(
				'customer-organization',
				utcBillingMonth(PERIOD_START)
			),
			'platform-service:customer-organization:2026-11'
		);
	});
});
