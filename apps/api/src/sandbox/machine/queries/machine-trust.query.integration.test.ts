/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { MACHINE_TRUST_POLICY } from '../../../billing/constants/machine-trust.constants';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import {
	JOB_LIFECYCLE_PHASE,
	MACHINE_ATTRIBUTION_SUBJECT,
	MACHINE_FAULT_DOMAIN,
	MACHINE_RELIABILITY_EVENT_KIND,
	MACHINE_RELIABILITY_OUTCOME,
	MACHINE_RELIABILITY_SEVERITY,
	MACHINE_RELIABILITY_SOURCE,
	MACHINE_WORKLOAD_OUTCOME_CLASS,
	type MachineAttributionSubject,
	type MachineReliabilityOutcome,
	type MachineReliabilitySource,
	type MachineWorkloadOutcomeClass,
} from '../constants/machine-reliability.constants';
import { Machine } from '../entities/machine.entity';
import { machineTrustTally } from './machine-trust.query';

const DATABASE_URL = integrationDatabaseUrl();
const EVENTS_PER_SCENARIO = 4;
const COUNTED_SUCCESS_BODIES = 2;
const SPEC_GENERATION = 1;
const TEST_REASON = 'trust-tally-test';
const WINDOW_START = new Date(0);
const MASS_TOLERANCE = 1e-6;

const { SUCCESS, FAILURE, NEUTRAL } = MACHINE_RELIABILITY_OUTCOME;
const { MACHINE, PLATFORM } = MACHINE_RELIABILITY_SOURCE;

function fingerprint(): string {
	return `sha256:${createHash('sha256').update(randomUUID()).digest('hex')}`;
}

interface EventSeed {
	machineId: string;
	fingerprint?: string;
	customer?: string;
	outcome: MachineReliabilityOutcome;
	source: MachineReliabilitySource;
	selfDealt?: boolean;
}

describe('machine trust tally attribution', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [Machine],
		});
	});

	after(async () => {
		await orm?.close(true);
	});

	it('treats a workload failing on other hosts as the workload fault', async () => {
		await scenario(async (manager, subject, peers) => {
			const workload = fingerprint();
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				fingerprint: workload,
				outcome: FAILURE,
				source: PLATFORM,
			});
			for (const peer of peers) {
				await peerOutcome(
					manager,
					MACHINE_ATTRIBUTION_SUBJECT.WORKLOAD,
					workload,
					peer,
					MACHINE_WORKLOAD_OUTCOME_CLASS.FAILURE
				);
			}
			const tally = await machineTrustTally(manager, subject, WINDOW_START);
			assert.equal(tally.counts.neutral, EVENTS_PER_SCENARIO);
			assert.equal(tally.counts.machineFailures, 0);
		});
	});

	it('sees through a customer rotating fingerprints across hosts', async () => {
		await scenario(async (manager, subject, peers) => {
			const customer = await organization(manager);
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				customer,
				outcome: FAILURE,
				source: PLATFORM,
			});
			for (const peer of peers) {
				await peerOutcome(
					manager,
					MACHINE_ATTRIBUTION_SUBJECT.CUSTOMER,
					customer,
					peer,
					MACHINE_WORKLOAD_OUTCOME_CLASS.FAILURE
				);
			}
			const tally = await machineTrustTally(manager, subject, WINDOW_START);
			assert.equal(tally.counts.neutral, EVENTS_PER_SCENARIO);
			assert.equal(tally.counts.machineFailures, 0);
		});
	});

	it('overrules a machine label the workload contradicts elsewhere', async () => {
		await scenario(async (manager, subject, peers) => {
			const workload = fingerprint();
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				fingerprint: workload,
				outcome: NEUTRAL,
				source: MACHINE,
			});
			for (const peer of peers) {
				await peerOutcome(
					manager,
					MACHINE_ATTRIBUTION_SUBJECT.WORKLOAD,
					workload,
					peer,
					MACHINE_WORKLOAD_OUTCOME_CLASS.SUCCESS
				);
			}
			const tally = await machineTrustTally(manager, subject, WINDOW_START);
			assert.equal(tally.counts.machineFailures, EVENTS_PER_SCENARIO);
			assert.equal(tally.counts.neutral, 0);
		});
	});

	it('keeps an uncontradicted label and every platform-observed failure', async () => {
		await scenario(async (manager, subject) => {
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				fingerprint: fingerprint(),
				outcome: NEUTRAL,
				source: MACHINE,
			});
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				fingerprint: fingerprint(),
				outcome: FAILURE,
				source: PLATFORM,
			});
			const tally = await machineTrustTally(manager, subject, WINDOW_START);
			assert.equal(tally.counts.neutral, EVENTS_PER_SCENARIO);
			assert.equal(tally.counts.machineFailures, EVENTS_PER_SCENARIO);
			assert.equal(tally.counts.platformObserved, EVENTS_PER_SCENARIO);
		});
	});

	it('ignores self-dealt evidence and discounts reported successes', async () => {
		await scenario(async (manager, subject) => {
			const workload = fingerprint();
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				fingerprint: workload,
				outcome: SUCCESS,
				source: MACHINE,
			});
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				fingerprint: workload,
				outcome: SUCCESS,
				source: PLATFORM,
			});
			await events(manager, EVENTS_PER_SCENARIO, {
				machineId: subject,
				fingerprint: workload,
				outcome: SUCCESS,
				source: PLATFORM,
				selfDealt: true,
			});
			const tally = await machineTrustTally(manager, subject, WINDOW_START);
			assert.equal(
				tally.counts.successful,
				COUNTED_SUCCESS_BODIES * EVENTS_PER_SCENARIO
			);
			const expected =
				EVENTS_PER_SCENARIO +
				EVENTS_PER_SCENARIO * MACHINE_TRUST_POLICY.machineReportedSuccessWeight;
			assert.ok(
				Math.abs(tally.window.outcomes.successful - expected) < MASS_TOLERANCE
			);
		});
	});

	async function scenario(
		body: (
			manager: EntityManager,
			subject: string,
			peers: string[]
		) => Promise<void>
	): Promise<void> {
		const manager = orm.em.fork();
		await manager.begin();
		try {
			const [subject, ...peers] = await Promise.all([
				hostedMachine(manager),
				hostedMachine(manager),
				hostedMachine(manager),
			]);
			manager.persist([subject, ...peers]);
			await manager.flush();
			await body(
				manager,
				subject.id,
				peers.map(({ organizationId }) => organizationId)
			);
		} finally {
			await manager.rollback();
		}
	}
});

async function hostedMachine(manager: EntityManager): Promise<Machine> {
	return new Machine({
		name: `trust-tally-${randomUUID()}`,
		apiVersion: '1',
		organizationId: await organization(manager),
	});
}

async function organization(manager: EntityManager): Promise<string> {
	const organizationId = randomUUID();
	await manager.execute(
		'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
		[organizationId, TEST_REASON, `${TEST_REASON}-${organizationId}`]
	);
	return organizationId;
}

async function events(
	manager: EntityManager,
	count: number,
	seed: EventSeed
): Promise<void> {
	for (let index = 0; index < count; index += 1) {
		await manager.execute(
			`INSERT INTO machine_reliability_event ("machineId", "workloadFingerprint", "customerOrganizationId", "eventKind", source, "selfDealt",
				phase, outcome, severity, "reasonCode", "faultDomain", "deduplicationKey", "evidenceDigest", "specGeneration", "observedAt")
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, transaction_timestamp())`,
			[
				seed.machineId,
				seed.fingerprint ?? fingerprint(),
				seed.customer ?? null,
				MACHINE_RELIABILITY_EVENT_KIND.SANDBOX_CONVERGENCE,
				seed.source,
				seed.selfDealt ?? false,
				JOB_LIFECYCLE_PHASE.WORKLOAD,
				seed.outcome,
				MACHINE_RELIABILITY_SEVERITY.INFO,
				TEST_REASON,
				MACHINE_FAULT_DOMAIN.UNKNOWN,
				`${TEST_REASON}:${randomUUID()}`,
				TEST_REASON,
				SPEC_GENERATION,
			]
		);
	}
}

async function peerOutcome(
	manager: EntityManager,
	subjectKind: MachineAttributionSubject,
	subject: string,
	host: string,
	outcomeClass: MachineWorkloadOutcomeClass
): Promise<void> {
	await manager.execute(
		`INSERT INTO machine_workload_outcome ("subjectKind", subject, host, "outcomeClass", "lastObservedAt")
		VALUES (?, ?, ?, ?, transaction_timestamp())`,
		[subjectKind, subject, host, outcomeClass]
	);
}
