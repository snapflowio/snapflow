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
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	LeaseRenewalDecision,
	type LeaseRenewalInput,
	type LeaseRenewalPrices,
	leaseRenewalDecision,
} from './lease-renewal.util';

const LEASE: LeaseRenewalPrices = {
	hourlyGrossMicroUsd: MicroUsd.of(1_000n),
	egressGrossMicroUsdPerGiB: MicroUsd.of(25_000n),
};
const ONE = MicroUsd.of(1n);
const HUNDRED = MicroUsd.of(100n);

function decide(overrides: Partial<LeaseRenewalInput>): LeaseRenewalDecision {
	return leaseRenewalDecision({
		selfUse: false,
		lease: LEASE,
		current: LEASE,
		maxHourlyPriceMicroUsd: null,
		maxEgressMicroUsdPerGiB: null,
		...overrides,
	});
}

describe('leaseRenewalDecision', () => {
	it('renews silently at equal or lower prices', () => {
		assert.equal(decide({}), LeaseRenewalDecision.RENEW);
		assert.equal(
			decide({
				current: {
					hourlyGrossMicroUsd: LEASE.hourlyGrossMicroUsd.subtract(ONE),
					egressGrossMicroUsdPerGiB: MicroUsd.ZERO,
				},
			}),
			LeaseRenewalDecision.RENEW
		);
	});

	it('treats a rise within the customer caps as consented', () => {
		assert.equal(
			decide({
				current: {
					hourlyGrossMicroUsd: LEASE.hourlyGrossMicroUsd.add(HUNDRED),
					egressGrossMicroUsdPerGiB:
						LEASE.egressGrossMicroUsdPerGiB.add(HUNDRED),
				},
				maxHourlyPriceMicroUsd: LEASE.hourlyGrossMicroUsd.add(HUNDRED),
				maxEgressMicroUsdPerGiB: LEASE.egressGrossMicroUsdPerGiB.add(HUNDRED),
			}),
			LeaseRenewalDecision.RENEW
		);
	});

	it('asks for consent for an hourly rise above the cap', () => {
		assert.equal(
			decide({
				current: {
					...LEASE,
					hourlyGrossMicroUsd: LEASE.hourlyGrossMicroUsd.add(MicroUsd.of(101n)),
				},
				maxHourlyPriceMicroUsd: LEASE.hourlyGrossMicroUsd.add(HUNDRED),
			}),
			LeaseRenewalDecision.CONSENT_REQUIRED
		);
		assert.equal(
			decide({
				current: {
					...LEASE,
					hourlyGrossMicroUsd: LEASE.hourlyGrossMicroUsd.add(ONE),
				},
			}),
			LeaseRenewalDecision.CONSENT_REQUIRED
		);
	});

	it('asks for consent for an egress rise above the cap', () => {
		assert.equal(
			decide({
				current: {
					...LEASE,
					egressGrossMicroUsdPerGiB: LEASE.egressGrossMicroUsdPerGiB.add(ONE),
				},
			}),
			LeaseRenewalDecision.CONSENT_REQUIRED
		);
	});

	it('asks for consent when the machine no longer offers a price', () => {
		assert.equal(
			decide({ current: null }),
			LeaseRenewalDecision.CONSENT_REQUIRED
		);
	});

	it('always renews an unpriced lease on the organization own machine', () => {
		assert.equal(
			decide({ selfUse: true, current: null }),
			LeaseRenewalDecision.RENEW
		);
	});
});
