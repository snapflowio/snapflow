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
import { create, toJsonString } from '@bufbuild/protobuf';
import {
	SpeedtestDirection,
	SpeedtestReceiptSchema,
} from '@snapflow/machine-proto';
import {
	SPOT_CHECK_CANARY,
	SPOT_CHECK_FAILURE,
} from '../constants/spot-check.constants';
import {
	canaryByteCount,
	canaryCommand,
	judgeCanary,
	parseCanaryReceipts,
} from './spot-check-canary.util';

const MEBIBYTE = 1_048_576n;
const EXPECTED = { uploadBytes: 20n * MEBIBYTE, downloadBytes: 30n * MEBIBYTE };

describe('spot-check network canary', () => {
	it('picks a secret volume inside the canary range', () => {
		for (let draw = 0; draw < 1_000; draw++) {
			const bytes = canaryByteCount();
			assert.ok(bytes >= SPOT_CHECK_CANARY.MINIMUM_BYTES);
			assert.ok(
				bytes < SPOT_CHECK_CANARY.MINIMUM_BYTES + SPOT_CHECK_CANARY.BYTE_SPREAD
			);
		}
	});

	it('passes a meter within the overhead band', () => {
		assert.deepEqual(
			judgeCanary(EXPECTED, {
				egressBytes: EXPECTED.uploadBytes + MEBIBYTE,
				ingressBytes: EXPECTED.downloadBytes + 2n * MEBIBYTE,
			}),
			[]
		);
	});

	it('fails an inflated meter in either direction', () => {
		assert.deepEqual(
			judgeCanary(EXPECTED, {
				egressBytes: EXPECTED.uploadBytes * 2n,
				ingressBytes: EXPECTED.downloadBytes,
			}),
			[SPOT_CHECK_FAILURE.NETWORK_METER_INFLATED]
		);
		assert.deepEqual(
			judgeCanary(EXPECTED, {
				egressBytes: EXPECTED.uploadBytes,
				ingressBytes: EXPECTED.downloadBytes * 2n,
			}),
			[SPOT_CHECK_FAILURE.NETWORK_METER_INFLATED]
		);
	});

	it('fails a meter that misses part of the signed volume', () => {
		assert.deepEqual(
			judgeCanary(EXPECTED, {
				egressBytes: EXPECTED.uploadBytes - 1n,
				ingressBytes: EXPECTED.downloadBytes,
			}),
			[SPOT_CHECK_FAILURE.NETWORK_METER_UNDERCOUNTED]
		);
	});

	it('passes the transfer through hidden environment variables', () => {
		const command = canaryCommand(
			{
				endpoint: 'VA',
				downloadToken: 'VB',
				uploadToken: 'VC',
				uploadBytes: 'VD',
			},
			{
				endpoint: 'https://edge.example.test',
				downloadToken: 'secret-download-token',
				uploadToken: 'secret-upload-token',
				uploadBytes: EXPECTED.uploadBytes,
			}
		);
		assert.equal(
			command.envs.VA,
			'https://edge.example.test/_snapflow/speedtest'
		);
		assert.equal(command.envs.VD, EXPECTED.uploadBytes.toString());
		assert.equal(command.envs.VB, 'secret-download-token');
		assert.ok(!command.command.includes('secret-'));
	});

	it('reads the download trailer and the upload body receipts', () => {
		const download = create(SpeedtestReceiptSchema, {
			direction: SpeedtestDirection.DOWNLOAD,
			bytes: 5n,
			edgeKeyId: 'key',
		});
		const upload = create(SpeedtestReceiptSchema, {
			direction: SpeedtestDirection.UPLOAD,
			bytes: 7n,
			edgeKeyId: 'key',
		});
		const output = `${Buffer.from(toJsonString(SpeedtestReceiptSchema, download)).toString('base64url')}\n${toJsonString(SpeedtestReceiptSchema, upload)}\n`;
		const parsed = parseCanaryReceipts(output);
		assert.equal(parsed?.download.bytes, 5n);
		assert.equal(parsed?.upload.bytes, 7n);
		assert.equal(parseCanaryReceipts('garbage'), null);
	});
});
