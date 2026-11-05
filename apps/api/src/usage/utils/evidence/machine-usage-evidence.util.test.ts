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
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import {
	MACHINE_USAGE_GENESIS_DIGEST,
	MachineUsageRuntimeState,
} from '../../../sandbox/machine/constants/machine-usage.constants';
import { MachineUsageEvidenceError } from '../../../sandbox/machine/exceptions/machine-usage-evidence.exception';
import {
	signedUsageChain,
	signUsageEnvelope,
	USAGE_MACHINE_ID,
} from '../../../sandbox/machine/testing/signed-usage-readings.fixtures';
import { verifyMachineUsageReceipt } from './machine-usage-evidence.util';

const START = new Date('2026-10-04T12:00:00.000Z');
const INTERVAL_MILLIS = 30 * MILLISECONDS_PER_SECOND;
const RESTORED_GENERATION = '5b1e7f0a-2c4d-4e6f-8a9b-0c1d2e3f4a5b';

function at(offsetMillis: number): Date {
	return new Date(START.getTime() + offsetMillis);
}

function threeReadings() {
	const [first, second, third] = signedUsageChain([
		{ sampledAt: at(0), runningMillis: 0 },
		{ sampledAt: at(INTERVAL_MILLIS), runningMillis: INTERVAL_MILLIS },
		{ sampledAt: at(2 * INTERVAL_MILLIS), runningMillis: 2 * INTERVAL_MILLIS },
	]);
	return { first, second, third };
}

function unsigned<T extends { signature: string }>(
	envelope: T
): Omit<T, 'signature'> {
	const { signature, ...rest } = envelope;
	assert.ok(signature.length > 0);
	return rest;
}

describe('verifyMachineUsageReceipt', () => {
	it('derives the interval of a chained reading from signed data alone', () => {
		const { second } = threeReadings();
		const verified = verifyMachineUsageReceipt(
			USAGE_MACHINE_ID,
			second,
			second.predecessor
		);
		assert.equal(verified.payloadDigest, second.payloadDigest);
		assert.equal(verified.intervalStartAt.getTime(), START.getTime());
		assert.equal(verified.intervalStartState, MachineUsageRuntimeState.STARTED);
		assert.equal(verified.computeMillis, BigInt(INTERVAL_MILLIS));
		assert.equal(verified.storageMillis, BigInt(INTERVAL_MILLIS));
	});

	it('opens a baseline with the genesis reading of a placement', () => {
		const { first } = threeReadings();
		assert.equal(first.envelope.previousDigest, MACHINE_USAGE_GENESIS_DIGEST);
		const verified = verifyMachineUsageReceipt(USAGE_MACHINE_ID, first, null);
		assert.equal(verified.computeMillis, 0n);
		assert.equal(verified.storageMillis, 0n);
	});

	it('refuses a reading presented with another predecessor than the one it names', () => {
		const { first, third } = threeReadings();
		assert.throws(
			() => verifyMachineUsageReceipt(USAGE_MACHINE_ID, third, first),
			MachineUsageEvidenceError
		);
	});

	it('refuses a chained reading without its predecessor', () => {
		const { second } = threeReadings();
		assert.throws(
			() => verifyMachineUsageReceipt(USAGE_MACHINE_ID, second, null),
			MachineUsageEvidenceError
		);
	});

	it('refuses a tampered predecessor', () => {
		const { first, second } = threeReadings();
		const tampered = {
			...first,
			envelope: { ...first.envelope, runningMillis: '1' },
		};
		assert.throws(
			() => verifyMachineUsageReceipt(USAGE_MACHINE_ID, second, tampered),
			MachineUsageEvidenceError
		);
	});

	it('refuses a genesis reading that restarts the chain of its own generation', () => {
		const { first, second } = threeReadings();
		const restarted = signUsageEnvelope({
			...unsigned(second.envelope),
			previousDigest: MACHINE_USAGE_GENESIS_DIGEST,
		});
		assert.throws(
			() =>
				verifyMachineUsageReceipt(
					USAGE_MACHINE_ID,
					{ signerPublicKey: second.signerPublicKey, envelope: restarted },
					first
				),
			MachineUsageEvidenceError
		);
	});

	it('meters storage only across a runtime generation change', () => {
		const chain = signedUsageChain([
			{ sampledAt: at(0), runningMillis: 0 },
			{
				sampledAt: at(INTERVAL_MILLIS),
				runningMillis: INTERVAL_MILLIS,
				generationId: RESTORED_GENERATION,
			},
		]);
		const restored = chain[1];
		assert.equal(
			restored.envelope.previousDigest,
			MACHINE_USAGE_GENESIS_DIGEST
		);
		const verified = verifyMachineUsageReceipt(
			USAGE_MACHINE_ID,
			restored,
			restored.predecessor
		);
		assert.equal(verified.computeMillis, 0n);
		assert.equal(verified.storageMillis, BigInt(INTERVAL_MILLIS));
	});

	it('refuses a reading signed by another key', () => {
		const { first } = threeReadings();
		assert.throws(
			() =>
				verifyMachineUsageReceipt(
					USAGE_MACHINE_ID,
					{ ...first, signerPublicKey: 'not a key' },
					null
				),
			MachineUsageEvidenceError
		);
	});
});
