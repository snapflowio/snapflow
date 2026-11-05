/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { v4 as uuidv4 } from 'uuid';
import { OCI_DIGEST_PREFIX } from '../../machine/constants/machine-snapshot.constants';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import type { SnapshotRepository } from '../repositories/snapshot.repository';
import { persistUniquelyNamed } from './unique-snapshot-name.util';

export interface PersistSnapshotFromSandboxParams {
	organizationId: string;
	name: string;
	ref: string;
	machineId?: string | null;
	sandboxClass: SandboxClass;
	cpu: number;
	gpu: number;
	gpuType?: GpuType | null;
	mem: number;
	disk: number;
	sizeGB?: number;
	hash?: string;
}

export async function persistSnapshotFromSandbox(
	entityManager: EntityManager,
	snapshotRepository: SnapshotRepository,
	params: PersistSnapshotFromSandboxParams
): Promise<Snapshot> {
	const size =
		typeof params.sizeGB === 'number' && Number.isFinite(params.sizeGB)
			? params.sizeGB
			: undefined;
	const machineId = params.machineId || undefined;

	const snapshot = entityManager.create(
		Snapshot,
		{
			id: uuidv4(),
			organizationId: params.organizationId,
			name: params.name,
			ref: params.ref,
			state: SnapshotState.ACTIVE,
			sandboxClass: params.sandboxClass,
			cpu: params.cpu,
			gpu: params.gpu,
			gpuType: params.gpuType ?? null,
			mem: params.mem,
			disk: params.disk,
			size,
			digest: params.hash ? `${OCI_DIGEST_PREFIX}${params.hash}` : null,
			initialMachineId: machineId,
			lastUsedAt: new Date(),
		},
		{ partial: true }
	);

	return persistUniquelyNamed(params.name, () =>
		snapshotRepository.insert(snapshot)
	);
}
