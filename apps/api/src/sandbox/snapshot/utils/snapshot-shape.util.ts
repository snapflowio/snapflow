/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import type { Sandbox } from '../../instance/entities/sandbox.entity';
import type { Snapshot } from '../entities/snapshot.entity';

export interface RequestedResources {
	cpu?: number;
	memory?: number;
	disk?: number;
	gpu?: number;
}

export type SnapshotSandboxShape = Pick<
	Sandbox,
	'sandboxClass' | 'cpu' | 'mem' | 'disk' | 'gpu' | 'gpuType'
>;

export function snapshotSandboxShape(
	requested: RequestedResources,
	snapshot: Pick<
		Snapshot,
		'sandboxClass' | 'cpu' | 'mem' | 'disk' | 'gpu' | 'gpuType'
	>
): SnapshotSandboxShape {
	const disk = requested.disk || snapshot.disk;
	if (disk < snapshot.disk) {
		throw new BadRequestException(
			`Disk must be at least the snapshot disk of ${snapshot.disk} GiB`
		);
	}
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
