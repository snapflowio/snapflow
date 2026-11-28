/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { DockerRegistry } from '../../docker-registry/entities/docker-registry.entity';
import {
	registryHost,
	registryProject,
} from '../../docker-registry/utils/docker-registry-url.util';
import { BACKUP_REPOSITORY } from '../constants/backup.constants';

export function backupRepository(
	registry: Pick<DockerRegistry, 'project'>,
	sandboxId: string
): string {
	return `${registryProject(registry)}/${BACKUP_REPOSITORY.PREFIX}${sandboxId}`;
}

export function backupSnapshotName(
	registry: Pick<DockerRegistry, 'url' | 'project'>,
	sandboxId: string,
	takenAt: Date
): string {
	const tag = takenAt
		.toISOString()
		.replace(
			BACKUP_REPOSITORY.TAG_UNSAFE_CHARACTERS,
			BACKUP_REPOSITORY.TAG_SEPARATOR
		);
	return `${registryHost(registry.url)}/${backupRepository(registry, sandboxId)}:${tag}`;
}
