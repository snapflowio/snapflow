/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { JobType } from '../enums/job-type.enum';
import { ResourceType } from '../enums/resource-type.enum';

interface JobTypeMap {
	[JobType.CREATE_BACKUP]: {
		resourceType: [ResourceType.SANDBOX];
	};
	[JobType.BACKUP_VOLUMES]: {
		resourceType: [ResourceType.SANDBOX];
	};
	[JobType.BUILD_SNAPSHOT]: {
		resourceType: [ResourceType.SANDBOX, ResourceType.SNAPSHOT];
	};
	[JobType.PUBLISH_SNAPSHOT]: {
		resourceType: [ResourceType.SNAPSHOT];
	};
	[JobType.INSPECT_SNAPSHOT_IN_REGISTRY]: {
		resourceType: [ResourceType.SNAPSHOT];
	};
	[JobType.SNAPSHOT_SANDBOX]: {
		resourceType: [ResourceType.SANDBOX];
	};
	[JobType.DELETE_VOLUME]: {
		resourceType: [ResourceType.VOLUME];
	};
	[JobType.RESIZE_VOLUME]: {
		resourceType: [ResourceType.VOLUME];
	};
	[JobType.RESTORE_VOLUME]: {
		resourceType: [ResourceType.VOLUME];
	};
	[JobType.QUALIFY_MACHINE]: {
		resourceType: [ResourceType.MACHINE];
	};
	[JobType.BENCHMARK_MACHINE]: {
		resourceType: [ResourceType.MACHINE];
	};
}

export type ResourceTypeForJobType<T extends JobType> =
	JobTypeMap[T]['resourceType'][number];
