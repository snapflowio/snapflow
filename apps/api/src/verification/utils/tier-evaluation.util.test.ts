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
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { TIER_REASON } from '../constants/machine-tier.constants';
import {
	diskMinimumMet,
	evaluateMachineTier,
	networkMinimumMet,
	type TierEvaluationInput,
	type TierPolicy,
} from './tier-evaluation.util';

const policy: TierPolicy = {
	verifiedMinimumListedDays: 30,
	verifiedMinimumUptimeBasisPoints: 9_900,
	verifiedMinimumSpotChecks: 2,
};

const datacenter: TierEvaluationInput = {
	listingPublic: true,
	kycComplete: true,
	benchmarkPassed: true,
	inventoryCurrent: true,
	fingerprintConflict: false,
	networkMinimumMet: true,
	diskMinimumMet: true,
	restricted: false,
	listedDays: 45,
	uptimeBasisPoints: 9_950,
	spotChecksPassed: 3,
	spotChecksFailed: 0,
	datacenterApproved: true,
	adminTierCap: null,
};

describe('evaluateMachineTier', () => {
	it('grants Datacenter when every requirement holds', () => {
		assert.deepEqual(evaluateMachineTier(datacenter, policy), {
			tier: MachineTier.DATACENTER,
			reasons: [],
		});
	});

	it('stops at Verified without datacenter approval', () => {
		assert.deepEqual(
			evaluateMachineTier({ ...datacenter, datacenterApproved: false }, policy),
			{
				tier: MachineTier.VERIFIED,
				reasons: [TIER_REASON.DATACENTER_NOT_APPROVED],
			}
		);
	});

	it('stops at Community while the track record is short', () => {
		assert.deepEqual(
			evaluateMachineTier(
				{
					...datacenter,
					listedDays: 10,
					uptimeBasisPoints: 9_000,
					spotChecksPassed: 1,
					spotChecksFailed: 1,
				},
				policy
			),
			{
				tier: MachineTier.COMMUNITY,
				reasons: [
					TIER_REASON.LISTED_DAYS,
					TIER_REASON.UPTIME,
					TIER_REASON.SPOT_CHECKS_MISSING,
					TIER_REASON.SPOT_CHECK_FAILED,
				],
			}
		);
	});

	it('keeps a machine private for any missing Community requirement', () => {
		const cases: [Partial<TierEvaluationInput>, string][] = [
			[{ listingPublic: false }, TIER_REASON.LISTING_NOT_PUBLIC],
			[{ kycComplete: false }, TIER_REASON.KYC_INCOMPLETE],
			[{ benchmarkPassed: false }, TIER_REASON.BENCHMARK_MISSING],
			[{ inventoryCurrent: false }, TIER_REASON.INVENTORY_CHANGED],
			[{ fingerprintConflict: true }, TIER_REASON.FINGERPRINT_CONFLICT],
			[{ networkMinimumMet: false }, TIER_REASON.NETWORK_BELOW_MINIMUM],
			[{ diskMinimumMet: false }, TIER_REASON.DISK_BELOW_MINIMUM],
			[{ restricted: true }, TIER_REASON.RESTRICTED],
		];
		for (const [override, reason] of cases) {
			assert.deepEqual(
				evaluateMachineTier({ ...datacenter, ...override }, policy),
				{ tier: MachineTier.PRIVATE, reasons: [reason] }
			);
		}
	});

	it('applies the admin cap and explains it', () => {
		assert.deepEqual(
			evaluateMachineTier(
				{ ...datacenter, adminTierCap: MachineTier.COMMUNITY },
				policy
			),
			{ tier: MachineTier.COMMUNITY, reasons: [TIER_REASON.ADMIN_CAP] }
		);
		assert.deepEqual(
			evaluateMachineTier(
				{
					...datacenter,
					kycComplete: false,
					adminTierCap: MachineTier.VERIFIED,
				},
				policy
			),
			{ tier: MachineTier.PRIVATE, reasons: [TIER_REASON.KYC_INCOMPLETE] }
		);
	});
});

describe('listing minimums', () => {
	const minimums = {
		listingMinimumDownlinkMbps: 200,
		listingMinimumUplinkMbps: 100,
		listingMinimumDiskRandomReadIops: 20_000,
		listingMinimumDiskSequentialMibps: 500,
	};

	it('requires measured values at or above every minimum', () => {
		const measured = {
			networkDownlinkMbps: 200,
			networkUplinkMbps: 100,
			diskRandomReadIops: 20_000,
			diskSequentialMibps: 500,
		};
		assert.equal(networkMinimumMet(measured, minimums), true);
		assert.equal(diskMinimumMet(measured, minimums), true);
		assert.equal(
			networkMinimumMet({ ...measured, networkUplinkMbps: 99 }, minimums),
			false
		);
		assert.equal(
			diskMinimumMet({ ...measured, diskSequentialMibps: null }, minimums),
			false
		);
	});
});
