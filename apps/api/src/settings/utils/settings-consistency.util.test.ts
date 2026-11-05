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
});
