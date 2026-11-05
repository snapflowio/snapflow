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
import { SETTINGS_DEFAULTS } from '../constants/settings.constants';
import {
	type ConsistencySettings,
	settingsInconsistency,
} from './settings-consistency.util';

const defaults: ConsistencySettings = {
	exposureCeilingProbationaryCents:
		SETTINGS_DEFAULTS.exposureCeilingProbationaryCents,
	exposureCeilingEstablishedCents:
		SETTINGS_DEFAULTS.exposureCeilingEstablishedCents,
	exposureCeilingHostCents: SETTINGS_DEFAULTS.exposureCeilingHostCents,
	voucherIntervalSeconds: SETTINGS_DEFAULTS.voucherIntervalSeconds,
	voucherGraceIntervals: SETTINGS_DEFAULTS.voucherGraceIntervals,
	voucherLifetimeHours: SETTINGS_DEFAULTS.voucherLifetimeHours,
	claimIntervalMinutes: SETTINGS_DEFAULTS.claimIntervalMinutes,
};

describe('settingsInconsistency', () => {
	it('accepts the defaults', () => {
		assert.equal(settingsInconsistency(defaults), null);
	});

	it('rejects exposure ceilings that shrink with trust', () => {
		assert.equal(
			settingsInconsistency({
				...defaults,
				exposureCeilingProbationaryCents:
					defaults.exposureCeilingEstablishedCents + 1,
			}),
			'exposureCeilingEstablishedCents must be at least exposureCeilingProbationaryCents'
		);
	});

	it('rejects a voucher grace window longer than half a voucher lifetime', () => {
		assert.equal(
			settingsInconsistency({
				...defaults,
				voucherLifetimeHours: 1,
				voucherIntervalSeconds: 1_801,
				voucherGraceIntervals: 1,
			}),
			'voucherIntervalSeconds * voucherGraceIntervals must be at most half of voucherLifetimeHours'
		);
	});

	it('rejects claims rarer than half a voucher lifetime', () => {
		assert.equal(
			settingsInconsistency({
				...defaults,
				voucherLifetimeHours: 2,
				claimIntervalMinutes: 61,
			}),
			'claimIntervalMinutes must be at most half of voucherLifetimeHours'
		);
		assert.equal(
			settingsInconsistency({
				...defaults,
				voucherLifetimeHours: 2,
				claimIntervalMinutes: 60,
			}),
			null
		);
	});
});
