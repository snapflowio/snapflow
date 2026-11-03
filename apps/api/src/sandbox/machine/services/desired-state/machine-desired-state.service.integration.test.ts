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
import { create, fromJsonString } from '@bufbuild/protobuf';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { ConflictException } from '@nestjs/common';
import {
	MachineDesiredStateSchema,
	SandboxImageSchema,
	SandboxLifecycle,
} from '@snapflow/machine-proto';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../../../common/testing/integration-database.util';
import {
	type HumanPrincipal,
	PLATFORM_PRINCIPAL_TYPE,
} from '../../../../common/types/platform-principal.types';
import { ENTITY_MAPPING_OPTIONS } from '../../../../infra/database/config/entity-mapping.config';
import { PlacementKind } from '../../../../marketplace/machine/enums/placement-kind.enum';
import { SandboxSecretBinding } from '../../../../secrets/entities/sandbox-secret-binding.entity';
import { SandboxSecretBindingSet } from '../../../../secrets/entities/sandbox-secret-binding-set.entity';
import { Secret } from '../../../../secrets/entities/secret.entity';
import { SecretVersion } from '../../../../secrets/entities/secret-version.entity';
import { MachineSandboxSecretDeliveryService } from '../../../../secrets/services/machine-sandbox-secret-delivery.service';
import { SecretService } from '../../../../secrets/services/secret.service';
import { SecretVersionCipherService } from '../../../../secrets/services/secret-version-cipher.service';
import { SystemRole } from '../../../../user/enums/system-role.enum';
import { Sandbox } from '../../../instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../../instance/entities/sandbox-placement.entity';
import { SandboxMode } from '../../../instance/enums/sandbox-mode.enum';
import { SandboxState } from '../../../instance/enums/sandbox-state.enum';
import { Machine } from '../../entities/machine.entity';
import { MachineSession } from '../../entities/machine-session.entity';
import { runtimeIntentUpdate } from '../../utils/proto/sandbox-runtime-intent.util';
import { buildSandboxSpec } from '../../utils/proto/sandbox-runtime-spec.util';
import { MachineSessionService } from '../machine-session.service';
import { DesiredSnapshotSetService } from './desired-snapshot-set.service';
import { MachineDesiredStateService } from './machine-desired-state.service';

const DATABASE_URL = integrationDatabaseUrl();
const ASSIGNMENT_GENERATION = 1;
const INITIAL_SPEC_GENERATION = 0;
const IMAGE_REF = 'registry.example.com/snapflow/base:1.0';
const SECRET_ENVIRONMENT_NAME = 'API_TOKEN';
const SECRET_VERSION = 1;
const ENVELOPE_FORMAT_VERSION = 1;
const SESSION_LIFETIME_MILLISECONDS = 60 * 60 * 1_000;

describe('machine desired-state secrets flag', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	let machine: Machine;
	let sandbox: Sandbox;
	let secretId: string;
	let secretVersionId: string;
	const organizationId = randomUUID();
	const principal: HumanPrincipal = {
		type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
		id: randomUUID(),
		email: 'secrets-flag@example.com',
		displayName: 'secrets-flag',
		systemRole: SystemRole.USER,
	};

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				Machine,
				Sandbox,
				SandboxPlacement,
				Secret,
				SecretVersion,
				SandboxSecretBinding,
				SandboxSecretBindingSet,
			],
		});
		const manager = orm.em.fork();
		await manager.execute(
			'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
			[organizationId, organizationId, organizationId]
		);
		machine = new Machine({
			name: `secrets-flag-${randomUUID()}`,
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
				{ specGeneration: INITIAL_SPEC_GENERATION },
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
				placedAt: new Date(),
				releasedAt: null,
				releaseReason: null,
			})
		);
		await manager.flush();
		secretId = randomUUID();
		secretVersionId = randomUUID();
		await manager.execute(
			'INSERT INTO secret (id, "organizationId", name, "normalizedName", "createdByPrincipalType", "createdByPrincipalId") VALUES (?, ?, ?, ?, ?, ?)',
			[
				secretId,
				organizationId,
				SECRET_ENVIRONMENT_NAME,
				SECRET_ENVIRONMENT_NAME,
				principal.type,
				principal.id,
			]
		);
		await manager.execute(
			'INSERT INTO secret_version (id, "organizationId", "secretId", version, "envelopeFormatVersion", "keyEncryptionKeyId", "encryptedEnvelope", "createdByPrincipalType", "createdByPrincipalId") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[
				secretVersionId,
				organizationId,
				secretId,
				SECRET_VERSION,
				ENVELOPE_FORMAT_VERSION,
				'secrets-flag',
				'sealed',
				principal.type,
				principal.id,
			]
		);
		await secrets().bindToSandbox(
			manager,
			organizationId,
			sandbox.id,
			{},
			undefined,
			principal
		);
		await manager.flush();
	});

	after(async () => {
		if (!orm) return;
		const manager = orm.em.fork();
		await manager.execute(
			'DELETE FROM sandbox_secret_binding WHERE "sandboxId" = ?',
			[sandbox.id]
		);
		await manager.execute(
			'DELETE FROM sandbox_secret_binding_set WHERE "sandboxId" = ?',
			[sandbox.id]
		);
		await manager.execute('DELETE FROM secret_version WHERE id = ?', [
			secretVersionId,
		]);
		await manager.execute('DELETE FROM secret WHERE id = ?', [secretId]);
		await manager.nativeDelete(SandboxPlacement, { sandboxId: sandbox.id });
		await manager.nativeDelete(Sandbox, { id: sandbox.id });
		await manager.nativeDelete(Machine, { id: machine.id });
		await manager.execute('DELETE FROM organization WHERE id = ?', [
			organizationId,
		]);
		await orm.close(true);
	});

	function secrets(): SecretService {
		return new SecretService(orm.em.fork());
	}

	function desiredState(): MachineDesiredStateService {
		const sessions = fakeInstance(MachineSessionService);
		mock.method(sessions, 'assertCurrent', async () => machine);
		const snapshots = fakeInstance(DesiredSnapshotSetService);
		mock.method(snapshots, 'forMachine', async () => []);
		return new MachineDesiredStateService(
			orm.em.fork(),
			sessions,
			snapshots,
			new MachineSandboxSecretDeliveryService(
				fakeInstance(SecretVersionCipherService)
			)
		);
	}

	async function listed() {
		const session = Object.assign(new MachineSession(), {
			id: randomUUID(),
			expiresAt: new Date(Date.now() + SESSION_LIFETIME_MILLISECONDS),
		});
		const { document } = await desiredState().build(machine.id, session);
		const [entry] = fromJsonString(
			MachineDesiredStateSchema,
			document
		).sandboxes;
		assert.ok(entry);
		return entry;
	}

	async function converge(
		lifecycle: SandboxLifecycle,
		state: SandboxState
	): Promise<void> {
		const manager = orm.em.fork();
		const current = await manager.findOneOrFail(Sandbox, { id: sandbox.id });
		await manager.nativeUpdate(
			Sandbox,
			{ id: sandbox.id },
			{ ...runtimeIntentUpdate(current, { lifecycle }), state }
		);
	}

	async function replaceBindings(names: readonly string[]): Promise<void> {
		await orm.em.fork().transactional(async (manager: EntityManager) => {
			const bindingSet = await manager.findOneOrFail(SandboxSecretBindingSet, {
				sandboxId: sandbox.id,
			});
			await secrets().replaceSandboxBindings(
				manager,
				organizationId,
				sandbox.id,
				bindingSet.resourceVersion,
				{ bindings: names.map((name) => ({ name, secretId })) },
				principal
			);
		});
	}

	it('tracks binding changes across stop, bind and start', async () => {
		const created = await listed();
		assert.equal(created.hasSecrets, false);

		await assert.rejects(
			replaceBindings([SECRET_ENVIRONMENT_NAME]),
			ConflictException
		);

		await converge(SandboxLifecycle.STOPPED, SandboxState.STOPPED);
		await replaceBindings([SECRET_ENVIRONMENT_NAME]);
		const bound = await listed();
		assert.equal(bound.lifecycle, SandboxLifecycle.STOPPED);
		assert.equal(bound.hasSecrets, true);

		await converge(SandboxLifecycle.STARTED, SandboxState.STARTED);
		const started = await listed();
		assert.equal(started.lifecycle, SandboxLifecycle.STARTED);
		assert.ok(started.specGeneration > bound.specGeneration);
		assert.equal(started.hasSecrets, true);

		await converge(SandboxLifecycle.STOPPED, SandboxState.STOPPED);
		await replaceBindings([]);
		await converge(SandboxLifecycle.STARTED, SandboxState.STARTED);
		const unbound = await listed();
		assert.ok(unbound.specGeneration > started.specGeneration);
		assert.equal(unbound.hasSecrets, false);
	});
});
