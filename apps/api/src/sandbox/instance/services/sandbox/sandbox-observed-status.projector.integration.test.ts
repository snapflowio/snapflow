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
import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { MikroORM } from '@mikro-orm/postgresql';
import {
	DesiredSnapshotSchema,
	MachineDesiredStateSchema,
	SandboxImageSchema,
	SandboxLifecycle,
	SandboxObservedStatusReportSchema,
	SandboxRuntimeState,
} from '@snapflow/machine-proto';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../../infra/database/config/entity-mapping.config';
import { PlacementKind } from '../../../../marketplace/machine/enums/placement-kind.enum';
import { MachineSandboxSecretDeliveryService } from '../../../../secrets/services/machine-sandbox-secret-delivery.service';
import { SecretVersionCipherService } from '../../../../secrets/services/secret-version-cipher.service';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineSession } from '../../../machine/entities/machine-session.entity';
import { DesiredSnapshotSetService } from '../../../machine/services/desired-state/desired-snapshot-set.service';
import { MachineDesiredStateService } from '../../../machine/services/desired-state/machine-desired-state.service';
import { MachineSessionService } from '../../../machine/services/machine-session.service';
import { MachineAssessmentService } from '../../../machine/services/qualification/machine-assessment.service';
import { MachineReliabilityService } from '../../../machine/services/qualification/machine-reliability.service';
import { runtimeIntentUpdate } from '../../../machine/utils/proto/sandbox-runtime-intent.util';
import { buildSandboxSpec } from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { OBSERVED_TRANSITION } from '../../constants/sandbox-state-machine.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxObservedStatus } from '../../entities/sandbox-observed-status.entity';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxObservedStatusProjector } from './sandbox-observed-status.projector';
import { SandboxObservedStatusService } from './sandbox-observed-status.service';

const DATABASE_URL = integrationDatabaseUrl();
const ASSIGNMENT_GENERATION = 1;
const SPEC_GENERATION = 2;
const IMAGE_REF = 'registry.example.com/snapflow/base:1.0';
const EARLIER = new Date('2026-10-04T12:00:00.000Z');
const LATER = new Date('2026-10-04T12:05:00.000Z');
const SESSION_LIFETIME_MILLISECONDS = 60 * 60 * 1_000;
const FIXTURE_ORGANIZATION_NAME = 'observed-status';

describe('sandbox observed status persistence', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	let machine: Machine;
	let sandbox: Sandbox;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [Machine, Sandbox, SandboxPlacement, SandboxObservedStatus],
		});
		const manager = orm.em.fork();
		const organizationId = randomUUID();
		await manager.execute(
			'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
			[organizationId, FIXTURE_ORGANIZATION_NAME, organizationId]
		);
		machine = new Machine({
			name: `observed-${randomUUID()}`,
			apiVersion: '1',
			organizationId,
		});
		sandbox = Object.assign(new Sandbox({}), {
			organizationId,
			mode: SandboxMode.STANDARD,
			osUser: 'snapflow',
			state: SandboxState.STARTED,
			machineId: machine.id,
		});
		Object.assign(
			sandbox,
			runtimeIntentUpdate(
				{ specGeneration: SPEC_GENERATION - 1 },
				{
					lifecycle: SandboxLifecycle.STARTED,
					spec: buildSandboxSpec({
						sandbox,
						source: {
							case: 'image',
							value: create(SandboxImageSchema, { ref: IMAGE_REF }),
						},
						fencedVolumes: new Map(),
						labels: {},
					}),
				}
			)
		);
		manager.persist([machine, sandbox]);
		await manager.flush();
		manager.persist(
			manager.create(SandboxPlacement, {
				id: randomUUID(),
				sandboxId: sandbox.id,
				machineId: machine.id,
				assignmentGeneration: ASSIGNMENT_GENERATION,
				fencingToken: randomUUID(),
				placementKind: PlacementKind.FLEXIBLE,
				placedAt: EARLIER,
				releasedAt: null,
				releaseReason: null,
			})
		);
		await manager.flush();
	});

	after(async () => {
		if (!orm) return;
		const manager = orm.em.fork();
		await manager.nativeDelete(SandboxObservedStatus, {
			sandboxId: sandbox.id,
		});
		await manager.nativeDelete(SandboxPlacement, { sandboxId: sandbox.id });
		await manager.nativeDelete(Sandbox, { id: sandbox.id });
		await manager.nativeDelete(Machine, { id: machine.id });
		await manager.execute('DELETE FROM organization WHERE id = ?', [
			sandbox.organizationId,
		]);
		await orm.close(true);
	});

	function sessions(): MachineSessionService {
		const service = fakeInstance(MachineSessionService);
		mock.method(service, 'assertCurrent', async () => machine);
		return service;
	}

	function session(): MachineSession {
		return Object.assign(new MachineSession(), {
			id: randomUUID(),
			expiresAt: new Date(LATER.getTime() + SESSION_LIFETIME_MILLISECONDS),
		});
	}

	function observedStatusService(): SandboxObservedStatusService {
		const projector = fakeInstance(SandboxObservedStatusProjector);
		mock.method(projector, 'project', async () => OBSERVED_TRANSITION.NONE);
		return new SandboxObservedStatusService(
			orm.em.fork(),
			sessions(),
			projector,
			Object.create(MachineReliabilityService.prototype),
			Object.create(MachineAssessmentService.prototype)
		);
	}

	function report(observedSpecGeneration: number, observedAt: Date): string {
		return toJsonString(
			SandboxObservedStatusReportSchema,
			create(SandboxObservedStatusReportSchema, {
				statuses: [
					{
						sandboxId: sandbox.id,
						assignmentGeneration: ASSIGNMENT_GENERATION,
						observedSpecGeneration,
						state: SandboxRuntimeState.STARTED,
						observedAt: timestampFromDate(observedAt),
					},
				],
			})
		);
	}

	async function storedStatus(): Promise<SandboxObservedStatus | null> {
		return orm.em
			.fork()
			.findOne(SandboxObservedStatus, { sandboxId: sandbox.id });
	}

	it('keeps the newest observed status per sandbox', async () => {
		const service = observedStatusService();

		await service.report(machine.id, session(), report(SPEC_GENERATION, LATER));
		await service.report(
			machine.id,
			session(),
			report(SPEC_GENERATION - 1, LATER)
		);
		await service.report(
			machine.id,
			session(),
			report(SPEC_GENERATION, EARLIER)
		);

		const stored = await storedStatus();
		assert.equal(stored?.observedSpecGeneration, SPEC_GENERATION);
		assert.equal(stored?.observedAt.getTime(), LATER.getTime());
		assert.equal(stored?.state, SandboxRuntimeState.STARTED);
	});

	it('lists the persisted runtime spec in the desired-state document', async () => {
		const desiredSnapshots = fakeInstance(DesiredSnapshotSetService);
		mock.method(desiredSnapshots, 'forMachine', async () => [
			create(DesiredSnapshotSchema, { ref: IMAGE_REF }),
		]);
		const desiredState = new MachineDesiredStateService(
			orm.em.fork(),
			sessions(),
			desiredSnapshots,
			new MachineSandboxSecretDeliveryService(
				fakeInstance(SecretVersionCipherService)
			)
		);

		const { digest, document } = await desiredState.build(
			machine.id,
			session()
		);

		const parsed = fromJsonString(MachineDesiredStateSchema, document);
		assert.equal(parsed.digest, digest);
		const [listed] = parsed.sandboxes;
		assert.equal(listed?.sandboxId, sandbox.id);
		assert.equal(listed?.assignmentGeneration, ASSIGNMENT_GENERATION);
		assert.equal(listed?.specGeneration, SPEC_GENERATION);
		assert.equal(listed?.spec?.source.case, 'image');
		assert.equal(listed?.specDigest, sandbox.runtimeSpecDigest);
		assert.equal(listed?.hasSecrets, false);
		assert.deepEqual(
			parsed.snapshots.map(({ ref }) => ref),
			[IMAGE_REF]
		);
	});

	it('refuses a runtime intent without a machine', async () => {
		await assert.rejects(
			orm.em
				.fork()
				.nativeUpdate(Sandbox, { id: sandbox.id }, { machineId: null })
		);
	});
});
