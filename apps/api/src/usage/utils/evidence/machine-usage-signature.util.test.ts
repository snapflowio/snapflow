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
import { MachineUsageRuntimeState } from '../../../machine/constants/machine-usage.constants';
import type { MachineUsageReceiptEnvelope } from '../../schemas/machine-usage-envelope.schema';
import {
	machineUsagePayloadDigest,
	machineUsageSignaturePayload,
} from './machine-usage-signature.util';

const MACHINE_ID = 'machine-1';
const GENESIS = '0'.repeat(64);
const GOLDEN_PAYLOAD =
	'25:snapflow.machine-usage.v5' +
	'9:machine-1' +
	'36:11111111-1111-4111-8111-111111111111' +
	'9:sandbox-1' +
	'1:2' +
	'36:22222222-2222-4222-8222-222222222222' +
	'36:33333333-3333-4333-8333-333333333333' +
	'1:1' +
	`64:${GENESIS}` +
	'24:2026-10-04T16:42:48.701Z' +
	'7:started' +
	'3:650' +
	'4:4096' +
	'4:8192' +
	'3:512' +
	'3:256' +
	'4:4700' +
	'4:8500' +
	'1:2' +
	'1:4' +
	'2:10' +
	'1:0';
const GOLDEN_DIGEST =
	'8ac90a1877193a481c6c26b6b37e4d16f9033d02e339a9a51617d6c6306d2c70';

const ENVELOPE: MachineUsageReceiptEnvelope = {
	placementId: '11111111-1111-4111-8111-111111111111',
	sandboxId: 'sandbox-1',
	assignmentGeneration: 2,
	fencingToken: '22222222-2222-4222-8222-222222222222',
	generationId: '33333333-3333-4333-8333-333333333333',
	sequence: '1',
	previousDigest: GENESIS,
	sampledAt: '2026-10-04T16:42:48.701Z',
	state: MachineUsageRuntimeState.STARTED,
	runningMillis: '650',
	internetEgressBytes: '4096',
	internetIngressBytes: '8192',
	hostEgressBytes: '512',
	hostIngressBytes: '256',
	tapEgressBytes: '4700',
	tapIngressBytes: '8500',
	cpu: 2,
	memoryGiB: 4,
	diskGiB: 10,
	gpu: 0,
	signature: 'unsigned',
};

describe('machine usage v5 signature payload', () => {
	it('frames every field in the order the machine signs them', () => {
		assert.equal(
			machineUsageSignaturePayload(MACHINE_ID, ENVELOPE),
			GOLDEN_PAYLOAD
		);
		assert.equal(
			machineUsagePayloadDigest(MACHINE_ID, ENVELOPE),
			GOLDEN_DIGEST
		);
	});
});
