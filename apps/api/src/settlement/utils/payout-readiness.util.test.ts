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
import { PayoutReadiness } from '../enums/payout-readiness.enum';
import { SanctionsStatus } from '../enums/sanctions-status.enum';
import { payoutReadiness } from './payout-readiness.util';

describe('payoutReadiness', () => {
	it('reports a missing payout wallet as not set up', () => {
		assert.equal(payoutReadiness(null), PayoutReadiness.NOT_SET_UP);
	});

	it('reports a sanctioned payout wallet as blocked', () => {
		assert.equal(
			payoutReadiness({ sanctionsStatus: SanctionsStatus.BLOCKED }),
			PayoutReadiness.BLOCKED
		);
	});

	it('reports a clear or unscreened payout wallet as ready', () => {
		for (const sanctionsStatus of [
			SanctionsStatus.CLEAR,
			SanctionsStatus.UNCHECKED,
		]) {
			assert.equal(payoutReadiness({ sanctionsStatus }), PayoutReadiness.READY);
		}
	});
});
