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
	topUpMinimumCents: SETTINGS_DEFAULTS.topUpMinimumCents,
	topUpMaximumCents: SETTINGS_DEFAULTS.topUpMaximumCents,
	autoTopUpMinimumCents: SETTINGS_DEFAULTS.autoTopUpMinimumCents,
	topUpPresetsCents: [...SETTINGS_DEFAULTS.topUpPresetsCents],
	exposureCeilingProbationaryCents:
		SETTINGS_DEFAULTS.exposureCeilingProbationaryCents,
	exposureCeilingEstablishedCents:
		SETTINGS_DEFAULTS.exposureCeilingEstablishedCents,
	exposureCeilingHostCents: SETTINGS_DEFAULTS.exposureCeilingHostCents,
	payoutHoldDatacenterDays: SETTINGS_DEFAULTS.payoutHoldDatacenterDays,
	payoutHoldVerifiedDays: SETTINGS_DEFAULTS.payoutHoldVerifiedDays,
	payoutHoldCommunityDays: SETTINGS_DEFAULTS.payoutHoldCommunityDays,
};

describe('settingsInconsistency', () => {
	it('accepts the defaults', () => {
		assert.equal(settingsInconsistency(defaults), null);
	});

	it('rejects a top-up maximum below the minimum', () => {
		assert.equal(
			settingsInconsistency({
				...defaults,
				topUpMinimumCents: 5_000,
				topUpMaximumCents: 4_000,
				autoTopUpMinimumCents: 5_000,
				topUpPresetsCents: [5_000],
			}),
			'topUpMaximumCents must be at least topUpMinimumCents'
		);
	});

	it('rejects an automatic top-up minimum below the top-up minimum', () => {
		assert.equal(
			settingsInconsistency({
				...defaults,
				autoTopUpMinimumCents: defaults.topUpMinimumCents - 1,
			}),
			'autoTopUpMinimumCents must be at least topUpMinimumCents'
		);
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

	it('rejects payout holds that grow with trust', () => {
		assert.equal(
			settingsInconsistency({
				...defaults,
				payoutHoldDatacenterDays: defaults.payoutHoldVerifiedDays + 1,
			}),
			'payoutHoldVerifiedDays must be at least payoutHoldDatacenterDays'
		);
	});

	it('rejects presets outside the top-up range', () => {
		assert.equal(
			settingsInconsistency({
				...defaults,
				topUpPresetsCents: [defaults.topUpMaximumCents + 1],
			}),
			`Top-up preset ${defaults.topUpMaximumCents + 1} must be between topUpMinimumCents and topUpMaximumCents`
		);
	});
});
