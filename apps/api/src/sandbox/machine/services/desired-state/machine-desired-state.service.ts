/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { toJsonString } from '@bufbuild/protobuf';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MachineDesiredStateSchema } from '@snapflow/machine-proto';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { runSerializableTransaction } from '../../../../infra/database/utils/serializable-transaction.util';
import { observeOperation } from '../../../../infra/logging/utils/operation-observability.util';
import { MachineSandboxSecretDeliveryService } from '../../../../secrets/services/machine-sandbox-secret-delivery.service';
import { Sandbox } from '../../../entities/sandbox.entity';
import { SandboxPlacement } from '../../../entities/sandbox-placement.entity';
import type { MachineDesiredStateDocumentDto } from '../../dto/machine-sandbox-control.dto';
import type { MachineSession } from '../../entities/machine-session.entity';
import {
	type DesiredSandboxRecord,
	machineDesiredStateDocument,
} from '../../utils/desired-state/machine-desired-state.util';
import { MachineSessionService } from '../machine-session.service';
import { DesiredSnapshotSetService } from './desired-snapshot-set.service';

@Injectable()
export class MachineDesiredStateService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		private readonly desiredSnapshots: DesiredSnapshotSetService,
		private readonly secretDelivery: MachineSandboxSecretDeliveryService
	) {}

	build(
		machineId: string,
		session: MachineSession
	): Promise<MachineDesiredStateDocumentDto> {
		return observeOperation(
			'machine.desired_state.build',
			{},
			() => this.buildDocument(machineId, session),
			{ 'machine.id': machineId }
		);
	}

	private buildDocument(
		machineId: string,
		session: MachineSession
	): Promise<MachineDesiredStateDocumentDto> {
		return runSerializableTransaction(this.entityManager, async (manager) => {
			const observedAt = await databaseNow(manager);
			const machine = await this.machineSessions.assertCurrent(
				manager,
				machineId,
				session.id,
				observedAt
			);
			const sandboxes = await manager.find(
				Sandbox,
				{ machineId, runtimeLifecycle: { $ne: null } },
				{
					fields: [
						'id',
						'specGeneration',
						'runtimeLifecycle',
						'runtimeSpec',
						'runtimeSpecDigest',
						'runtimeDirectives',
						'runtimeRegistryId',
					],
					orderBy: { id: 'ASC' },
				}
			);
			const placements =
				sandboxes.length === 0
					? []
					: await manager.find(SandboxPlacement, {
							machineId,
							releasedAt: null,
							sandboxId: { $in: sandboxes.map(({ id }) => id) },
						});
			const sandboxIdsWithSecrets =
				await this.secretDelivery.sandboxesWithSecrets(
					manager,
					sandboxes.map(({ id }) => id)
				);
			const generationBySandboxId = new Map(
				placements.map((placement) => [
					placement.sandboxId,
					placement.assignmentGeneration,
				])
			);
			const document = machineDesiredStateDocument({
				revision: machine.desiredStateRevision,
				generatedAt: machine.desiredStateGeneratedAt,
				expiresAt: session.expiresAt,
				sandboxes: sandboxes.map((sandbox) =>
					desiredSandboxRecord(
						sandbox,
						generationBySandboxId.get(sandbox.id),
						sandboxIdsWithSecrets.has(sandbox.id)
					)
				),
				snapshots: await this.desiredSnapshots.forMachine(
					manager,
					machine,
					sandboxes
				),
			});
			return {
				digest: document.digest,
				document: toJsonString(MachineDesiredStateSchema, document),
			};
		});
	}
}

function desiredSandboxRecord(
	sandbox: Pick<
		Sandbox,
		| 'id'
		| 'specGeneration'
		| 'runtimeLifecycle'
		| 'runtimeSpec'
		| 'runtimeSpecDigest'
		| 'runtimeDirectives'
	>,
	assignmentGeneration: number | undefined,
	hasSecrets: boolean
): DesiredSandboxRecord {
	if (
		assignmentGeneration === undefined ||
		sandbox.runtimeLifecycle === null ||
		!sandbox.runtimeSpec ||
		!sandbox.runtimeSpecDigest
	) {
		throw new InternalServerErrorException(
			`Sandbox ${sandbox.id} has a runtime intent without an active placement and spec`
		);
	}
	return {
		sandboxId: sandbox.id,
		assignmentGeneration,
		specGeneration: sandbox.specGeneration,
		lifecycle: sandbox.runtimeLifecycle,
		runtimeSpec: sandbox.runtimeSpec,
		runtimeSpecDigest: sandbox.runtimeSpecDigest,
		runtimeDirectives: sandbox.runtimeDirectives,
		hasSecrets,
	};
}
