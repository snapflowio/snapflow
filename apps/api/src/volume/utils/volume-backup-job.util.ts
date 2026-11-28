/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fromJsonString } from '@bufbuild/protobuf';
import type {
	BackupVolumesResultSchema,
	CreateBackupResultSchema,
	VolumeBackupResult,
} from '@snapflow/machine-proto';
import type { Job } from '../../machine-job/entities/job.entity';
import { JobStatus } from '../../machine-job/enums/job-status.enum';

type VolumeBackupResultSchema =
	| typeof CreateBackupResultSchema
	| typeof BackupVolumesResultSchema;

export function completedVolumeBackupResults(
	job: Pick<Job, 'id' | 'status' | 'resultMetadata'>,
	schema: VolumeBackupResultSchema
): VolumeBackupResult[] {
	if (job.status !== JobStatus.COMPLETED) {
		return [];
	}
	if (!job.resultMetadata) {
		throw new Error(`Completed backup job ${job.id} has no result`);
	}
	return fromJsonString(schema, job.resultMetadata).volumeBackups;
}
