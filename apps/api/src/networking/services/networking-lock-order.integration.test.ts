/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DeadlockException } from '@mikro-orm/core';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { fakeInstance } from '../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { TransactionCommitHooks } from '../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { MachineSession } from '../../sandbox/machine/entities/machine-session.entity';
import { MachineSessionService } from '../../sandbox/machine/services/machine-session.service';
import {
	EdgeBindingAcknowledgementDto,
	EdgeCapacitySnapshotDto,
	EdgeHeartbeatDto,
} from '../dto/edge-heartbeat.dto';
import { MachineTunnelTargetPlanAcknowledgementDto } from '../dto/machine-tunnel-observation.dto';
import { Edge } from '../entities/edge.entity';
import { MachineEdgeBinding } from '../entities/machine-edge-binding.entity';
import {
	deleteNetworkingFixture,
	FIXTURE_SESSION_GENERATION,
	fixtureCapacity,
	fixtureEdgeSession,
	fixtureMaterializer,
	inertWakes,
	NETWORKING_FIXTURE_ENTITIES,
	networkingFixture,
	seedNetworkingFixture,
} from '../testing/networking-database.fixtures';
import { EdgeActivityService } from './edge/edge-activity.service';
import { EdgeHeartbeatService } from './edge/edge-heartbeat.service';
import { EdgeSessionService } from './edge/edge-session.service';
import { ExposureActivationService } from './exposure/exposure-activation.service';
import { MachineTunnelObservationService } from './machine-tunnel/machine-tunnel-observation.service';
import { NetworkControlVersionService } from './network-control-version.service';

const DATABASE_URL = integrationDatabaseUrl();
const ITERATIONS = 40;
const ACTORS_PER_KIND = 3;
const EDGE_VERSION = 'lock-order-integration';

describe('networking lock order under concurrency', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const fixture = networkingFixture('lock-order');
	const { machine, edgeId, exposureId } = fixture;
	const connectionId = randomUUID();

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: NETWORKING_FIXTURE_ENTITIES,
		});
		await seedNetworkingFixture(orm.em.fork(), fixture);
		await fixtureMaterializer(orm.em.fork()).reconcile(exposureId);
		await orm.em
			.fork()
			.nativeUpdate(
				MachineEdgeBinding,
				{ machineId: machine.id },
				{ replacementConnectionId: connectionId }
			);
	});

	after(async () => {
		if (!orm) return;
		await deleteNetworkingFixture(orm.em.fork(), fixture);
		await orm.close(true);
	});

	it('never deadlocks heartbeat acknowledgement, target-plan acknowledgement and materialization', async () => {
		const failures: unknown[] = [];
		for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
			const { binding, edge } = await currentFences(orm.em.fork());
			const actors = [...Array(ACTORS_PER_KIND).keys()].flatMap(() => [
				heartbeat(orm.em.fork()).record(
					fixtureEdgeSession(fixture),
					heartbeatInput(binding, edge)
				),
				tunnelObservation(orm.em.fork()).acknowledgeTargetPlan(
					machine.id,
					machineSession(),
					targetPlanAcknowledgement(binding)
				),
				fixtureMaterializer(orm.em.fork()).reconcile(exposureId),
			]);
			for (const outcome of await Promise.allSettled(actors)) {
				if (outcome.status === 'rejected') failures.push(outcome.reason);
			}
		}

		const deadlocks = failures.filter(
			(failure) => failure instanceof DeadlockException
		);
		assert.deepEqual(deadlocks, []);
		for (const failure of failures) {
			assert.ok(failure instanceof ConflictException, String(failure));
		}
		const { binding } = await currentFences(orm.em.fork());
		assert.equal(binding.activeConnectionId, connectionId);
		assert.notEqual(binding.lastAcknowledgedAt, null);
	});

	async function currentFences(manager: EntityManager) {
		const binding = await manager.findOneOrFail(MachineEdgeBinding, {
			machineId: machine.id,
			edgeId,
		});
		const edge = await manager.findOneOrFail(Edge, { id: edgeId });
		return { binding, edge };
	}

	function machineSession(): MachineSession {
		return Object.assign(new MachineSession(), {
			id: randomUUID(),
			generation: FIXTURE_SESSION_GENERATION,
		});
	}

	function heartbeatInput(
		binding: MachineEdgeBinding,
		edge: Edge
	): EdgeHeartbeatDto {
		return Object.assign(new EdgeHeartbeatDto(), {
			startedAt: new Date().toISOString(),
			version: EDGE_VERSION,
			routeTableVersion: edge.routeTableVersion,
			capacity: Object.assign(new EdgeCapacitySnapshotDto(), fixtureCapacity()),
			bindingAcknowledgements: [
				Object.assign(new EdgeBindingAcknowledgementDto(), {
					machineId: machine.id,
					bindingId: binding.id,
					connectionId,
					bindingRevision: binding.revision,
					bindingDigest: binding.digest,
				}),
			],
			routeListeners: [],
		});
	}

	function targetPlanAcknowledgement(
		binding: MachineEdgeBinding
	): MachineTunnelTargetPlanAcknowledgementDto {
		return Object.assign(new MachineTunnelTargetPlanAcknowledgementDto(), {
			bindingId: binding.id,
			bindingRevision: binding.revision,
			bindingDigest: binding.digest,
			targetRevision: binding.targetRevision,
			targetDigest: binding.targetDigest,
		});
	}

	function heartbeat(manager: EntityManager): EdgeHeartbeatService {
		return new EdgeHeartbeatService(
			manager,
			new EdgeSessionService(manager, inertWakes()),
			activation(),
			fakeInstance(EdgeActivityService, {
				observeAccessSessions: async () => ({
					sessions: [],
					revokedSessionIds: [],
				}),
			})
		);
	}

	function tunnelObservation(
		manager: EntityManager
	): MachineTunnelObservationService {
		return new MachineTunnelObservationService(
			manager,
			fakeInstance(MachineSessionService, {
				assertCurrent: async () => machine,
			}),
			activation()
		);
	}

	function activation(): ExposureActivationService {
		return new ExposureActivationService(
			new NetworkControlVersionService(inertWakes()),
			inertWakes(),
			fakeInstance(EventEmitter2, { emit: () => true }),
			fakeInstance(TransactionCommitHooks, { runAfterCommit: () => undefined })
		);
	}
});
