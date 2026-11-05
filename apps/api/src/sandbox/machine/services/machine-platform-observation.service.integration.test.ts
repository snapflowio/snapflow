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
import { after, before, describe, it, mock } from 'node:test';
import { MikroORM } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import {
	JOB_LIFECYCLE_PHASE,
	MACHINE_FAULT_DOMAIN,
	MACHINE_RELIABILITY_EVENT_KIND,
	MACHINE_RELIABILITY_OUTCOME,
	MACHINE_RELIABILITY_SEVERITY,
	MACHINE_RELIABILITY_SOURCE,
} from '../constants/machine-reliability.constants';
import { Machine } from '../entities/machine.entity';
import { MachinePlatformObservationService } from './machine-platform-observation.service';
import { MachineAssessmentService } from './qualification/machine-assessment.service';
import { MachineReliabilityService } from './qualification/machine-reliability.service';

const DATABASE_URL = integrationDatabaseUrl();
const OS_USER = 'snapflow';
const SPEC_GENERATION = 1;
const ASSIGNMENT_GENERATION = 1;
const PLACEMENT_COUNT = 3;
const SERVED_REASON = 'edge-served-test';

describe('edge-served placement observation', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const organizationId = randomUUID();
	const machine = new Machine({
		name: `edge-served-${randomUUID()}`,
		apiVersion: '1',
		organizationId,
	});
	const sandboxes = Array.from({ length: PLACEMENT_COUNT }, () =>
		Object.assign(new Sandbox({}), {
			organizationId,
			mode: SandboxMode.STANDARD,
			osUser: OS_USER,
			state: SandboxState.STARTED,
			machineId: machine.id,
		})
	);
	const placementIds = sandboxes.map(() => randomUUID());

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [Machine, Sandbox, SandboxPlacement],
		});
		const manager = orm.em.fork();
		await manager.execute(
			'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
			[organizationId, organizationId, organizationId]
		);
		manager.persist([machine, ...sandboxes]);
		await manager.flush();
		manager.persist(
			sandboxes.map((sandbox, index) =>
				manager.create(SandboxPlacement, {
					id: placementIds[index],
					sandboxId: sandbox.id,
					machineId: machine.id,
					assignmentGeneration: ASSIGNMENT_GENERATION,
					fencingToken: randomUUID(),
					placementKind: PlacementKind.FLEXIBLE,
					placedAt: new Date(),
					releasedAt: null,
					releaseReason: null,
				})
			)
		);
		await manager.flush();
		for (const placementId of placementIds.slice(0, -1)) {
			await manager.execute(
				`INSERT INTO machine_reliability_event ("machineId", "placementId", "workloadFingerprint", "eventKind", source, "selfDealt",
					phase, outcome, severity, "reasonCode", "faultDomain", "deduplicationKey", "evidenceDigest", "specGeneration", "observedAt")
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, transaction_timestamp())`,
				[
					machine.id,
					placementId,
					`${SERVED_REASON}:${placementId}`,
					MACHINE_RELIABILITY_EVENT_KIND.EDGE_SERVED,
					MACHINE_RELIABILITY_SOURCE.PLATFORM,
					false,
					JOB_LIFECYCLE_PHASE.NETWORK,
					MACHINE_RELIABILITY_OUTCOME.SUCCESS,
					MACHINE_RELIABILITY_SEVERITY.INFO,
					SERVED_REASON,
					MACHINE_FAULT_DOMAIN.UNKNOWN,
					`${SERVED_REASON}:${randomUUID()}`,
					SERVED_REASON,
					SPEC_GENERATION,
				]
			);
		}
	});

	after(async () => {
		if (!orm) return;
		const manager = orm.em.fork();
		await manager.execute(
			'DELETE FROM machine_reliability_event WHERE "machineId" = ?',
			[machine.id]
		);
		await manager.nativeDelete(SandboxPlacement, {
			id: { $in: placementIds },
		});
		await manager.nativeDelete(Sandbox, {
			id: { $in: sandboxes.map(({ id }) => id) },
		});
		await manager.nativeDelete(Machine, { id: machine.id });
		await manager.execute('DELETE FROM organization WHERE id = ?', [
			organizationId,
		]);
		await orm.close(true);
	});

	it('observes only the served placements that have no edge-served event yet', async () => {
		const service = new MachinePlatformObservationService(
			orm.em.fork(),
			fakeInstance(MachineReliabilityService),
			fakeInstance(MachineAssessmentService)
		);
		const observed: string[] = [];
		mock.method(
			service,
			'observePlacement',
			async (
				...observation: Parameters<
					MachinePlatformObservationService['observePlacement']
				>
			) => {
				observed.push(observation[1]);
			}
		);

		await service.observeEdgeServed([...placementIds, placementIds[0]]);

		assert.deepEqual(observed, placementIds.slice(-1));
	});
});
