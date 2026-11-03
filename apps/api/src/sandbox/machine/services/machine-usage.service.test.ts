/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException } from '@nestjs/common';
import {
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
} from '../../../common/constants/time.constants';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { SandboxPlacement } from '../../instance/entities/sandbox-placement.entity';
import {
	MACHINE_USAGE_GENESIS_DIGEST,
	MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS,
	MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS,
} from '../constants/machine-usage.constants';
import type { MachineUsageReceiptDto } from '../dto/machine-usage.dto';
import { Machine } from '../entities/machine.entity';
import { MachineSession } from '../entities/machine-session.entity';
import { MachineUsageReceipt } from '../entities/machine-usage-receipt.entity';
import {
	type SignedUsageReceipt,
	signedUsageChain,
	signUsageEnvelope,
	USAGE_MACHINE_ID,
	USAGE_PLACEMENT,
	USAGE_SIGNER_PUBLIC_KEY,
	type UsageReadingSpec,
} from '../testing/signed-usage-readings.fixtures';
import { MachineSessionService } from './machine-session.service';
import { MachineUsageService } from './machine-usage.service';

const PLACEMENT_AGE_MILLIS = 30 * MILLISECONDS_PER_MINUTE;
const INTERVAL_MILLIS = 30 * MILLISECONDS_PER_SECOND;
const SKEW_MARGIN_MILLIS = MILLISECONDS_PER_SECOND;
const OBSERVED_AT = new Date('2026-10-04T12:00:00.000Z');
const PLACED_AT = new Date(OBSERVED_AT.getTime() - PLACEMENT_AGE_MILLIS);
const LIST_LIMIT = 10;
const OTHER_GENERATION = '5b1e7f0a-2c4d-4e6f-8a9b-0c1d2e3f4a5b';

interface Stored {
	head: MachineUsageReceipt | null;
	opener: MachineUsageReceipt | null;
	replayed: MachineUsageReceipt | null;
}

function placement(): SandboxPlacement {
	return Object.assign(new SandboxPlacement(), {
		id: USAGE_PLACEMENT.placementId,
		machineId: USAGE_MACHINE_ID,
		sandboxId: USAGE_PLACEMENT.sandboxId,
		assignmentGeneration: USAGE_PLACEMENT.assignmentGeneration,
		fencingToken: USAGE_PLACEMENT.fencingToken,
		placedAt: PLACED_AT,
		releasedAt: null,
	});
}

function ago(millis: number): Date {
	return new Date(OBSERVED_AT.getTime() - millis);
}

function stored(receipt: SignedUsageReceipt): MachineUsageReceipt {
	return Object.assign(new MachineUsageReceipt(), {
		id: receipt.id,
		payloadDigest: receipt.payloadDigest,
		generationId: receipt.envelope.generationId,
		sequence: receipt.envelope.sequence,
		signerPublicKey: receipt.signerPublicKey,
		envelope: receipt.envelope,
		acceptedComputeDeltaMillis: '0',
		acceptedStorageDeltaMillis: '0',
	});
}

function input(receipt: SignedUsageReceipt): MachineUsageReceiptDto {
	return { ...receipt.envelope };
}

function usageService(state: Stored) {
	const manager = fakeInstance(EntityManager);
	mock.method(
		manager,
		'transactional',
		async (operation: (transaction: EntityManager) => Promise<unknown>) =>
			operation(manager)
	);
	mock.method(manager, 'execute', async () => [{ now: OBSERVED_AT }]);
	mock.method(
		manager,
		'findOne',
		async (entity: unknown, where: Record<string, unknown>) => {
			if (entity === Machine) {
				return Object.assign(new Machine(), {
					id: USAGE_MACHINE_ID,
					identityPublicKey: USAGE_SIGNER_PUBLIC_KEY,
				});
			}
			if (entity === SandboxPlacement) return placement();
			if ('payloadDigest' in where) return state.replayed;
			return typeof where.generationId === 'string' ? state.head : state.opener;
		}
	);
	const persisted: MachineUsageReceipt[] = [];
	const persist = mock.method(
		manager,
		'persist',
		(receipt: MachineUsageReceipt) => {
			persisted.push(receipt);
			return manager;
		}
	);
	const sessions = fakeInstance(MachineSessionService);
	mock.method(sessions, 'assertCurrent', async () => new Machine());
	return {
		service: new MachineUsageService(manager, sessions),
		manager,
		persist,
		persisted,
	};
}

function record(state: Partial<Stored>, receipt: MachineUsageReceiptDto) {
	const session = Object.assign(new MachineSession(), { id: 'session-1' });
	const { service, persist, persisted } = usageService({
		head: null,
		opener: null,
		replayed: null,
		...state,
	});
	return {
		accepted: service.record(USAGE_MACHINE_ID, session, receipt),
		persist,
		persisted,
	};
}

function chain(...specs: UsageReadingSpec[]) {
	return signedUsageChain(specs);
}

describe('machine usage receipt ingestion', () => {
	it('meters a reading that extends the head of its chain', async () => {
		const [first, second] = chain(
			{ sampledAt: ago(INTERVAL_MILLIS), runningMillis: 0 },
			{ sampledAt: OBSERVED_AT, runningMillis: INTERVAL_MILLIS }
		);

		const { accepted, persisted } = record(
			{ head: stored(first) },
			input(second)
		);

		assert.equal(
			(await accepted).acceptedComputeDeltaMillis,
			INTERVAL_MILLIS.toString()
		);
		const [saved] = persisted;
		assert.equal(saved.previousDigest, first.payloadDigest);
		assert.equal(saved.predecessorId, first.id);
	});

	it('answers a replayed reading with the receipt it already accepted', async () => {
		const [first] = chain({ sampledAt: OBSERVED_AT, runningMillis: 0 });
		const replayed = stored(first);

		const { accepted, persist } = record({ replayed }, input(first));

		assert.equal((await accepted).id, replayed.id);
		assert.equal(persist.mock.callCount(), 0);
	});

	it('refuses a reading that skips the head of its chain', async () => {
		const [first, second, third] = chain(
			{ sampledAt: ago(2 * INTERVAL_MILLIS), runningMillis: 0 },
			{ sampledAt: ago(INTERVAL_MILLIS), runningMillis: INTERVAL_MILLIS },
			{ sampledAt: OBSERVED_AT, runningMillis: 2 * INTERVAL_MILLIS }
		);
		assert.equal(third.envelope.previousDigest, second.payloadDigest);

		await assert.rejects(
			record({ head: stored(first) }, input(third)).accepted,
			BadRequestException
		);
	});

	it('refuses a genesis reading once its generation has a chain', async () => {
		const [first] = chain({
			sampledAt: ago(INTERVAL_MILLIS),
			runningMillis: 0,
		});
		const [restart] = chain({ sampledAt: OBSERVED_AT, runningMillis: 0 });
		assert.equal(restart.envelope.previousDigest, MACHINE_USAGE_GENESIS_DIGEST);

		await assert.rejects(
			record({ head: stored(first) }, input(restart)).accepted,
			BadRequestException
		);
	});

	it('refuses a reading whose chain link was altered after signing', async () => {
		const [first, second] = chain(
			{ sampledAt: ago(INTERVAL_MILLIS), runningMillis: 0 },
			{ sampledAt: OBSERVED_AT, runningMillis: INTERVAL_MILLIS }
		);
		const forged = {
			...input(second),
			previousDigest: first.payloadDigest.replace(/^./, 'f'),
		};

		await assert.rejects(
			record(
				{
					head: Object.assign(stored(first), {
						payloadDigest: forged.previousDigest,
					}),
				},
				forged
			).accepted,
			BadRequestException
		);
	});

	it('opens a new generation at the last reading of the previous one', async () => {
		const [previous, restored] = chain(
			{
				sampledAt: ago(INTERVAL_MILLIS),
				runningMillis: 0,
				generationId: OTHER_GENERATION,
			},
			{ sampledAt: OBSERVED_AT, runningMillis: 0 }
		);

		const { accepted, persisted } = record(
			{ opener: stored(previous) },
			input(restored)
		);

		const receipt = await accepted;
		assert.equal(receipt.acceptedComputeDeltaMillis, '0');
		assert.equal(
			receipt.acceptedStorageDeltaMillis,
			INTERVAL_MILLIS.toString()
		);
		const [saved] = persisted;
		assert.equal(saved.predecessorId, previous.id);
	});

	it('accepts Machine clocks skewed within the tolerance in both directions', async () => {
		for (const sampledAt of [
			ago(-(MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS - SKEW_MARGIN_MILLIS)),
			ago(
				MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS +
					MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS -
					SKEW_MARGIN_MILLIS
			),
		]) {
			const [reading] = chain({ sampledAt, runningMillis: 0 });
			const { persist, accepted } = record({}, input(reading));
			await accepted;
			assert.equal(persist.mock.callCount(), 1);
		}
	});

	it('refuses a Machine clock running ahead beyond the tolerated skew', async () => {
		const [reading] = chain({
			sampledAt: ago(
				-(MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS + SKEW_MARGIN_MILLIS)
			),
			runningMillis: 0,
		});

		await assert.rejects(
			record({}, input(reading)).accepted,
			BadRequestException
		);
	});

	it('refuses a reading lagging beyond the skew and delivery deadline', async () => {
		const [reading] = chain({
			sampledAt: ago(
				MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS +
					MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS +
					SKEW_MARGIN_MILLIS
			),
			runningMillis: 0,
		});

		await assert.rejects(
			record({}, input(reading)).accepted,
			BadRequestException
		);
	});

	it('refuses a reading sampled before its placement by more than the tolerated skew', async () => {
		const [reading] = chain({
			sampledAt: new Date(
				PLACED_AT.getTime() -
					MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS -
					SKEW_MARGIN_MILLIS
			),
			runningMillis: 0,
		});

		await assert.rejects(
			record({}, input(reading)).accepted,
			BadRequestException
		);
	});

	it('refuses a reading of a fenced placement', async () => {
		const [reading] = chain({ sampledAt: OBSERVED_AT, runningMillis: 0 });
		const fenced = signUsageEnvelope({
			...reading.envelope,
			fencingToken: OTHER_GENERATION,
		});

		await assert.rejects(record({}, fenced).accepted, BadRequestException);
	});

	it('refuses a reading its signature does not cover', async () => {
		const [reading] = chain({ sampledAt: OBSERVED_AT, runningMillis: 0 });

		await assert.rejects(
			record({}, { ...input(reading), runningMillis: '1' }).accepted,
			BadRequestException
		);
	});

	it('refuses running time beyond the placement age on the API clock', async () => {
		const [reading] = chain({
			sampledAt: OBSERVED_AT,
			runningMillis: PLACEMENT_AGE_MILLIS + 2 * MILLISECONDS_PER_MINUTE,
		});

		await assert.rejects(
			record({}, input(reading)).accepted,
			BadRequestException
		);
	});

	it('lists released placements for as long as reconciliation accepts their readings', async () => {
		const { service, manager } = usageService({
			head: null,
			opener: null,
			replayed: null,
		});
		const queried: unknown[][] = [];
		mock.method(manager, 'execute', async (...query: [string, unknown[]]) => {
			queried.push(query[1]);
			return [];
		});

		await service.listReportablePlacements(USAGE_MACHINE_ID, LIST_LIMIT);

		assert.equal(
			queried[0]?.[1],
			MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS
		);
	});
});
