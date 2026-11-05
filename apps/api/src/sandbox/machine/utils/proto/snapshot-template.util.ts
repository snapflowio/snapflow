/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create } from '@bufbuild/protobuf';
import {
	type TemplatePreparation,
	TemplatePreparationSchema,
} from '@snapflow/machine-proto';
import type { Sandbox } from '../../../entities/sandbox.entity';
import type { Snapshot } from '../../../snapshot/entities/snapshot.entity';

export type SnapshotTemplatePreparation = Pick<
	TemplatePreparation,
	'cpuQuota' | 'memoryQuota' | 'storageQuota' | 'capabilities'
>;

export function snapshotTemplatePreparation(
	snapshot: Pick<Snapshot, 'cpu' | 'mem' | 'disk'>
): SnapshotTemplatePreparation {
	return {
		cpuQuota: snapshot.cpu,
		memoryQuota: snapshot.mem,
		storageQuota: snapshot.disk,
		capabilities: [],
	};
}

export function sandboxTemplatePreparation(
	sandbox: Pick<Sandbox, 'cpu' | 'mem' | 'disk' | 'capabilities'>
): SnapshotTemplatePreparation {
	return {
		cpuQuota: sandbox.cpu,
		memoryQuota: sandbox.mem,
		storageQuota: sandbox.disk,
		capabilities: [...sandbox.capabilities],
	};
}

export function templatePreparationMessage(
	template: SnapshotTemplatePreparation
): TemplatePreparation {
	return create(TemplatePreparationSchema, template);
}
