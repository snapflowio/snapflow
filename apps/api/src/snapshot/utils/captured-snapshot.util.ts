/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { SnapshotSandboxResult } from '@snapflow/machine-proto';
import { v4 as uuidv4 } from 'uuid';
import type { DockerRegistry } from '../../docker-registry/entities/docker-registry.entity';
import { registryRepositoryPrefix } from '../../docker-registry/utils/docker-registry-url.util';
import { OCI_DIGEST_PREFIX } from '../../machine/constants/machine-snapshot.constants';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SNAPSHOT_CAPTURE } from '../constants/snapshot-capture.constants';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';

type CaptureSource = Pick<
	Sandbox,
	| 'organizationId'
	| 'machineId'
	| 'sandboxClass'
	| 'cpu'
	| 'gpu'
	| 'gpuType'
	| 'mem'
	| 'disk'
>;

interface CapturedSnapshot {
	snapshot: Snapshot;
	reference: string;
}

function capturedSnapshotReference(
	registry: Pick<DockerRegistry, 'url' | 'project'>,
	snapshotId: string
): string {
	return `${registryRepositoryPrefix(registry)}/${SNAPSHOT_CAPTURE.REPOSITORY_PREFIX}${snapshotId}:${SNAPSHOT_CAPTURE.TAG}`;
}

export function newCapturedSnapshot(
	entityManager: EntityManager,
	source: CaptureSource,
	name: string,
	registry: Pick<DockerRegistry, 'url' | 'project'>
): CapturedSnapshot {
	const id = uuidv4();
	const reference = capturedSnapshotReference(registry, id);
	const snapshot = entityManager.create(
		Snapshot,
		{
			id,
			organizationId: source.organizationId,
			name,
			ref: reference,
			state: SnapshotState.CAPTURING,
			sandboxClass: source.sandboxClass,
			cpu: source.cpu,
			gpu: source.gpu,
			gpuType: source.gpuType ?? null,
			mem: source.mem,
			disk: source.disk,
			initialMachineId: source.machineId ?? undefined,
			lastUsedAt: new Date(),
		},
		{ partial: true }
	);
	return { snapshot, reference };
}

export function capturedSnapshotCompletion(
	result: SnapshotSandboxResult
): Partial<Snapshot> {
	return {
		state: SnapshotState.ACTIVE,
		errorReason: null,
		size: Number.isFinite(result.sizeGb) ? result.sizeGb : undefined,
		digest: result.hash ? `${OCI_DIGEST_PREFIX}${result.hash}` : null,
	};
}
