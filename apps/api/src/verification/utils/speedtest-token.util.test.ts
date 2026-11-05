/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { verify } from 'node:crypto';
import { describe, it } from 'node:test';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { SPEEDTEST_TOKEN } from '../constants/benchmark-policy.constants';
import {
	signSpeedtestToken,
	speedtestSigningKey,
	speedtestTokenSignedBytes,
} from './speedtest-token.util';

const KEY_ID = 'k1';
const SEED = Buffer.alloc(32, 7);
const CLAIMS = {
	benchmarkId: 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a',
	expiresAt: new Date('2026-10-14T13:00:00.000Z'),
	byteBudget: SPEEDTEST_TOKEN.BYTE_BUDGET,
};
const PUBLISHED_TOKEN =
	'k1.AdTl9qe4yU0OjxorPE1eb3oAAAAAas980AAAACAAAAAANY_K8eFnrMwKLxbk5nSD379ki706IxlEQ_rRgiSwyjXF5z47WfBNc5ux3KI_Jz20vDaMFpjawR2SIOdMzVX8Dw';
const PAYLOAD_BYTES = 33;
const BENCHMARK_OFFSET = 1;
const EXPIRY_OFFSET = 17;
const BUDGET_OFFSET = 25;
const SIGNATURE_BYTES = 64;

describe('speedtest token', () => {
	const key = speedtestSigningKey(KEY_ID, SEED);
	const token = signSpeedtestToken(key, CLAIMS);

	it('is deterministic and matches the published vector', () => {
		assert.equal(signSpeedtestToken(key, CLAIMS), token);
		assert.equal(token, PUBLISHED_TOKEN);
	});

	it('carries the version, benchmark, expiry and byte budget under an edge-verifiable signature', () => {
		const separator = token.lastIndexOf(SPEEDTEST_TOKEN.KEY_SEPARATOR);
		assert.equal(token.slice(0, separator), KEY_ID);
		const body = Buffer.from(token.slice(separator + 1), 'base64url');
		assert.equal(body.length, PAYLOAD_BYTES + SIGNATURE_BYTES);
		const payload = body.subarray(0, PAYLOAD_BYTES);
		assert.equal(payload[0], SPEEDTEST_TOKEN.VERSION);
		assert.equal(
			payload.subarray(BENCHMARK_OFFSET, EXPIRY_OFFSET).toString('hex'),
			CLAIMS.benchmarkId.replaceAll('-', '')
		);
		assert.equal(
			payload.readBigUInt64BE(EXPIRY_OFFSET),
			BigInt(CLAIMS.expiresAt.getTime() / MILLISECONDS_PER_SECOND)
		);
		assert.equal(payload.readBigUInt64BE(BUDGET_OFFSET), CLAIMS.byteBudget);
		assert.equal(
			verify(
				null,
				speedtestTokenSignedBytes(payload),
				key.publicKey,
				body.subarray(PAYLOAD_BYTES)
			),
			true
		);
	});

	it('changes with the benchmark and the expiry', () => {
		assert.notEqual(
			signSpeedtestToken(key, {
				...CLAIMS,
				expiresAt: new Date('2026-10-14T13:00:01.000Z'),
			}),
			token
		);
		assert.notEqual(
			signSpeedtestToken(key, {
				...CLAIMS,
				benchmarkId: '9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4',
			}),
			token
		);
	});
});
