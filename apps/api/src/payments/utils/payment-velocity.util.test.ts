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
import { PaymentsErrorCode } from '../constants/payments.constants';
import {
	organizationsBeyondFingerprintLimit,
	topUpVelocityViolation,
} from './payment-velocity.util';

const LIMITS = { topUpAttemptsPerHour: 5, paymentMethodsPerDay: 3 };

describe('payment velocity limits', () => {
	it('allows attempts below both limits', () => {
		assert.equal(
			topUpVelocityViolation(
				{ topUpAttemptsLastHour: 4, paymentMethodsLastDay: 2 },
				LIMITS
			),
			null
		);
	});

	it('refuses the attempt that reaches the hourly limit', () => {
		assert.equal(
			topUpVelocityViolation(
				{ topUpAttemptsLastHour: 5, paymentMethodsLastDay: 0 },
				LIMITS
			),
			PaymentsErrorCode.TOP_UP_ATTEMPTS_EXCEEDED
		);
	});

	it('refuses once the daily payment methods are used up', () => {
		assert.equal(
			topUpVelocityViolation(
				{ topUpAttemptsLastHour: 0, paymentMethodsLastDay: 3 },
				LIMITS
			),
			PaymentsErrorCode.PAYMENT_METHODS_EXCEEDED
		);
	});

	it('suspends only the newest organizations beyond the card limit', () => {
		const organizations = [
			{ organizationId: 'c', createdAt: new Date('2026-10-03T00:00:00.000Z') },
			{ organizationId: 'a', createdAt: new Date('2026-10-01T00:00:00.000Z') },
			{ organizationId: 'b', createdAt: new Date('2026-10-02T00:00:00.000Z') },
		];
		assert.deepEqual(organizationsBeyondFingerprintLimit(organizations, 2), [
			'c',
		]);
		assert.deepEqual(organizationsBeyondFingerprintLimit(organizations, 3), []);
	});
});
