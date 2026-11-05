/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create } from '@bufbuild/protobuf';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
	type DesiredSnapshot,
	DesiredSnapshotSchema,
	SnapshotLocalSourceSchema,
	SnapshotRegistrySourceSchema,
	SnapshotRetention,
} from '@snapflow/machine-proto';
import type { DockerRegistry } from '../../../../docker-registry/persistence/entities/docker-registry.entity';
import { DockerRegistryService } from '../../../../docker-registry/services/docker-registry.service';
import { findRegistryByUrlMatch } from '../../../../docker-registry/utils/registry-match.util';
import { Sandbox } from '../../../entities/sandbox.entity';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { MACHINE_QUALIFICATION_CANARY_SNAPSHOT } from '../../constants/machine-qualification.constants';
import type { Machine } from '../../entities/machine.entity';
import { MachineSnapshotTarget } from '../../entities/machine-snapshot-target.entity';
import { MachineSnapshotTargetReason } from '../../enums/machine-snapshot-target-reason.enum';
import {
	type DesiredSnapshotSource,
	mergeDesiredSnapshots,
	type SnapshotDemand,
} from '../../utils/desired-state/desired-snapshot-set.util';
import { decodeSandboxSpec } from '../../utils/proto/sandbox-runtime-spec.util';
import {
	snapshotTemplatePreparation,
	templatePreparationMessage,
} from '../../utils/proto/snapshot-template.util';

const ANONYMOUS_SOURCE: DesiredSnapshotSource = { kind: 'registry' };
const LOCAL_SOURCE: DesiredSnapshotSource = { kind: 'local' };

export type DesiredSnapshotSandbox = Pick<
	Sandbox,
	'id' | 'runtimeSpec' | 'runtimeRegistryId'
>;

@Injectable()
export class DesiredSnapshotSetService {
	constructor(private readonly dockerRegistryService: DockerRegistryService) {}

	machineSandboxes(
		manager: EntityManager,
		machineId: string
	): Promise<DesiredSnapshotSandbox[]> {
		return manager.find(
			Sandbox,
			{ machineId, runtimeLifecycle: { $ne: null } },
			{ fields: ['id', 'runtimeSpec', 'runtimeRegistryId'] }
		);
	}

	async forMachine(
		manager: EntityManager,
		machine: Pick<Machine, 'id'>,
		sandboxes: readonly DesiredSnapshotSandbox[]
	): Promise<DesiredSnapshot[]> {
		const demands = [
			...sandboxDemands(sandboxes),
			...(await this.targetDemands(manager, machine)),
			{
				ref: MACHINE_QUALIFICATION_CANARY_SNAPSHOT,
				source: ANONYMOUS_SOURCE,
				template: null,
				retention: SnapshotRetention.REQUIRED,
			},
		];
		const merged = mergeDesiredSnapshots(demands);
		const snapshots = await this.snapshotsByRef(manager, [...merged.keys()]);
		return [...merged.values()].map((demand) => {
			const snapshot = snapshots.get(demand.ref);
			const template =
				demand.template ??
				(snapshot ? snapshotTemplatePreparation(snapshot) : null);
			return create(DesiredSnapshotSchema, {
				ref: demand.ref,
				digest: snapshot?.digest ?? undefined,
				source:
					demand.source.kind === 'local'
						? { case: 'local', value: create(SnapshotLocalSourceSchema) }
						: {
								case: 'registry',
								value: create(SnapshotRegistrySourceSchema, {
									registryId: demand.source.registryId,
								}),
							},
				template: template ? templatePreparationMessage(template) : undefined,
				retention: demand.retention,
			});
		});
	}

	private async targetDemands(
		manager: EntityManager,
		machine: Pick<Machine, 'id'>
	): Promise<SnapshotDemand[]> {
		const targets = await manager.find(MachineSnapshotTarget, {
			machineId: machine.id,
		});
		const registries = targets.some(
			({ reason }) => reason !== MachineSnapshotTargetReason.BUILD_CACHE
		)
			? await this.dockerRegistryService.internalRegistries()
			: [];
		const demands: SnapshotDemand[] = [];
		for (const target of targets) {
			const source = targetSource(target, registries);
			if (source) {
				demands.push({
					ref: target.snapshotRef,
					source,
					template: target.template,
					retention:
						target.reason === MachineSnapshotTargetReason.PREWARM
							? SnapshotRetention.PREWARM
							: SnapshotRetention.REQUIRED,
				});
			}
		}
		return demands;
	}

	private async snapshotsByRef(
		manager: EntityManager,
		refs: readonly string[]
	): Promise<Map<string, Snapshot>> {
		const snapshots = await manager.find(
			Snapshot,
			{ ref: { $in: [...refs] }, state: { $ne: SnapshotState.REMOVING } },
			{ orderBy: { createdAt: 'ASC', id: 'ASC' } }
		);
		const byRef = new Map<string, Snapshot>();
		for (const snapshot of snapshots) {
			if (!snapshot.ref) continue;
			const current = byRef.get(snapshot.ref);
			if (!current || snapshot.state === SnapshotState.ACTIVE) {
				byRef.set(snapshot.ref, snapshot);
			}
		}
		return byRef;
	}
}

function sandboxDemands(
	sandboxes: readonly DesiredSnapshotSandbox[]
): SnapshotDemand[] {
	return sandboxes.flatMap((sandbox): SnapshotDemand[] => {
		if (!sandbox.runtimeSpec) return [];
		const source = decodeSandboxSpec(sandbox.runtimeSpec).source;
		if (source.case !== 'image' && source.case !== 'backup') return [];
		return [
			{
				ref: source.value.ref,
				source: sandbox.runtimeRegistryId
					? { kind: 'registry', registryId: sandbox.runtimeRegistryId }
					: LOCAL_SOURCE,
				template: null,
				retention: SnapshotRetention.REQUIRED,
			},
		];
	});
}

function targetSource(
	target: MachineSnapshotTarget,
	registries: readonly DockerRegistry[]
): DesiredSnapshotSource | null {
	if (target.reason === MachineSnapshotTargetReason.BUILD_CACHE) {
		return LOCAL_SOURCE;
	}
	const registry = findRegistryByUrlMatch(registries, target.snapshotRef);
	if (registry) return { kind: 'registry', registryId: registry.id };
	return target.reason === MachineSnapshotTargetReason.PREWARM
		? ANONYMOUS_SOURCE
		: null;
}
