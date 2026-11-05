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
import { fromJson, fromJsonString } from '@bufbuild/protobuf';
import {
	BenchmarkMachinePayloadSchema,
	BenchmarkProfile,
} from '@snapflow/machine-proto';
import { BENCHMARK_SUITE_VERSION } from '../constants/benchmark-policy.constants';
import { registrationChallenge } from './benchmark-challenge.util';
import { spotCheckChallengeJson } from './spot-check-command.util';

const ISSUED_AT = new Date('2026-10-14T12:00:00.000Z');
const EXPIRES_AT = new Date('2026-10-14T13:00:00.000Z');
const NONCE = 'ab'.repeat(32);
const SHAPE = { cpu: 4, memoryGib: 16, diskGib: 100, gpu: 0 };

describe('benchmark challenges', () => {
	it('issues registration challenges with the registration profile', () => {
		const payload = fromJson(
			BenchmarkMachinePayloadSchema,
			registrationChallenge(
				{
					id: 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a',
					nonce: NONCE,
					suiteVersion: BENCHMARK_SUITE_VERSION,
					...SHAPE,
					issuedAt: ISSUED_AT,
					expiresAt: EXPIRES_AT,
				},
				'https://edge.example.test/_snapflow/speedtest',
				'k1.token'
			)
		);
		assert.equal(payload.profile, BenchmarkProfile.REGISTRATION);
		assert.equal(payload.suiteVersion, BENCHMARK_SUITE_VERSION);
		assert.equal(payload.speedtestToken, 'k1.token');
	});

	it('issues spot-check challenges with the spot-check profile', () => {
		const payload = fromJsonString(
			BenchmarkMachinePayloadSchema,
			spotCheckChallengeJson({
				id: '9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4',
				nonce: NONCE,
				shape: SHAPE,
				issuedAt: ISSUED_AT,
				expiresAt: EXPIRES_AT,
			})
		);
		assert.equal(payload.profile, BenchmarkProfile.SPOT_CHECK);
		assert.equal(payload.suiteVersion, BENCHMARK_SUITE_VERSION);
	});
});
