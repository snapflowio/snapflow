/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';

export const BUILD_OBJECT_KIND = {
	CONTEXT: 'context',
	LOG: 'log',
} as const;

export interface BuildObject {
	key: string;
	organizationId: string;
	kind: (typeof BUILD_OBJECT_KIND)[keyof typeof BUILD_OBJECT_KIND];
	hash: string;
}

const REFERENCED_BUILD_OBJECTS_SQL = `SELECT candidate.key
	FROM unnest(ARRAY[?]::text[], ARRAY[?]::uuid[], ARRAY[?]::text[], ARRAY[?]::text[])
		AS candidate(key, "organizationId", kind, hash)
	WHERE EXISTS (
		SELECT 1 FROM build_info
		WHERE (
			EXISTS (SELECT 1 FROM snapshot
				WHERE snapshot."buildInfoSnapshotRef" = build_info."snapshotRef"
				  AND snapshot."organizationId" = candidate."organizationId")
			OR EXISTS (SELECT 1 FROM sandbox
				WHERE sandbox."buildInfoSnapshotRef" = build_info."snapshotRef"
				  AND sandbox."organizationId" = candidate."organizationId"
				  AND sandbox.state <> ?)
		)
		AND (
			(candidate.kind = ? AND candidate.hash = ANY(string_to_array(build_info."contextHashes", ',')))
			OR (candidate.kind = ? AND candidate.hash = encode(sha256(convert_to(build_info."snapshotRef", 'UTF8')), 'hex'))
		)
	)`;

export async function referencedBuildObjects(
	manager: EntityManager,
	objects: readonly BuildObject[]
): Promise<Set<string>> {
	if (objects.length === 0) return new Set();
	const rows = await manager.execute<{ key: string }[]>(
		REFERENCED_BUILD_OBJECTS_SQL,
		[
			objects.map(({ key }) => key),
			objects.map(({ organizationId }) => organizationId),
			objects.map(({ kind }) => kind),
			objects.map(({ hash }) => hash),
			SandboxState.DESTROYED,
			BUILD_OBJECT_KIND.CONTEXT,
			BUILD_OBJECT_KIND.LOG,
		]
	);
	return new Set(rows.map(({ key }) => key));
}
