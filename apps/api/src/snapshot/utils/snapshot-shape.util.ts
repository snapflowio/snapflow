/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { Snapshot } from '../entities/snapshot.entity';
import { SnapshotErrorCode } from '../enums/snapshot-error-code.enum';

interface RequestedResources {
	cpu?: number;
	memory?: number;
	disk?: number;
	gpu?: number;
}

export type SnapshotSandboxShape = Pick<
	Sandbox,
	'sandboxClass' | 'cpu' | 'mem' | 'disk' | 'gpu' | 'gpuType'
>;

type SandboxSnapshot = Pick<
	Snapshot,
	'name' | 'sandboxClass' | 'cpu' | 'mem' | 'disk' | 'size' | 'gpu' | 'gpuType'
>;

function minimumDiskGiB(snapshot: Pick<Snapshot, 'disk' | 'size'>): number {
	return Math.max(snapshot.disk, Math.ceil(snapshot.size ?? 0));
}

function assertDiskFitsSnapshot(
	diskGiB: number,
	snapshot: Pick<Snapshot, 'name' | 'disk' | 'size'>
): void {
	const minimum = minimumDiskGiB(snapshot);
	if (diskGiB >= minimum) return;
	throw new BadRequestException(
		apiError(
			SnapshotErrorCode.DISK_TOO_SMALL,
			`Snapshot ${snapshot.name} needs a disk of at least ${minimum} GiB, but the request asks for ${diskGiB} GiB. Request at least ${minimum} GiB of disk, or use a smaller snapshot.`
		)
	);
}

export function snapshotSandboxShape(
	requested: RequestedResources,
	snapshot: SandboxSnapshot
): SnapshotSandboxShape {
	const disk = requested.disk || minimumDiskGiB(snapshot);
	assertDiskFitsSnapshot(disk, snapshot);
	const gpu = requested.gpu ?? snapshot.gpu;
	return {
		sandboxClass: snapshot.sandboxClass,
		cpu: requested.cpu || snapshot.cpu,
		mem: requested.memory || snapshot.mem,
		disk,
		gpu,
		gpuType: gpu > 0 ? (snapshot.gpuType ?? null) : null,
	};
}
