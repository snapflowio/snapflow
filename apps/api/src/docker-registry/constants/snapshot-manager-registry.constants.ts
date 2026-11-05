/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RegistryType } from '../persistence/enums/registry-type.enum';

export const SNAPSHOT_MANAGER_REGISTRY_TYPES = [
	RegistryType.INTERNAL,
	RegistryType.BACKUP,
	RegistryType.TRANSIENT,
] as const;

export type SnapshotManagerRegistryType =
	(typeof SNAPSHOT_MANAGER_REGISTRY_TYPES)[number];

export const SNAPSHOT_MANAGER_REGISTRIES: Readonly<
	Record<SnapshotManagerRegistryType, { id: string; name: string }>
> = {
	[RegistryType.INTERNAL]: {
		id: '00000000-0000-4000-8000-000000000001',
		name: 'Snapshot Manager snapshots',
	},
	[RegistryType.BACKUP]: {
		id: '00000000-0000-4000-8000-000000000002',
		name: 'Snapshot Manager backups',
	},
	[RegistryType.TRANSIENT]: {
		id: '00000000-0000-4000-8000-000000000003',
		name: 'Snapshot Manager uploads and build caches',
	},
};
