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
import { SETTINGS_DEFAULTS } from '../../settings/constants/settings.constants';
import { MachineTier } from '../enums/machine-tier.enum';
import { marketMarkupBasisPoints } from './markup.util';

describe('marketMarkupBasisPoints', () => {
	it('charges the verified rate on Verified and Datacenter machines', () => {
		for (const tier of [MachineTier.VERIFIED, MachineTier.DATACENTER]) {
			assert.equal(
				marketMarkupBasisPoints(SETTINGS_DEFAULTS, tier),
				SETTINGS_DEFAULTS.verifiedMarkupBasisPoints
			);
		}
	});

	it('charges the standard rate below the Verified tier', () => {
		for (const tier of [MachineTier.PRIVATE, MachineTier.COMMUNITY]) {
			assert.equal(
				marketMarkupBasisPoints(SETTINGS_DEFAULTS, tier),
				SETTINGS_DEFAULTS.standardMarkupBasisPoints
			);
		}
	});

	it('follows the settings', () => {
		assert.equal(
			marketMarkupBasisPoints(
				{ standardMarkupBasisPoints: 1_000, verifiedMarkupBasisPoints: 2_500 },
				MachineTier.VERIFIED
			),
			2_500
		);
	});
});
