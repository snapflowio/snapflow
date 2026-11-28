/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { BYTES_PER_GIBIBYTE } from '../../marketplace/constants/pricing.constants';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { SnapshotState } from '../../snapshot/enums/snapshot-state.enum';
import { VolumeBackupState } from '../../volume/enums/volume-backup-state.enum';

export interface StoredBytes {
	organizationId: string;
	storedBytes: bigint;
}

export async function storedBytes(
	manager: EntityManager,
	organizationId: string | null = null
): Promise<StoredBytes[]> {
	const rows = await manager.execute<
		{ organizationId: string; storedBytes: string }[]
	>(
		`WITH stored AS (
			SELECT image."organizationId", image.bytes FROM (
				SELECT DISTINCT ON (snapshot."organizationId", coalesce(snapshot.ref, snapshot.id::text))
					snapshot."organizationId", ceil(snapshot.size * ?::numeric)::bigint AS bytes
				FROM snapshot
				WHERE snapshot."organizationId" IS NOT NULL AND snapshot.general = false
				  AND snapshot.size IS NOT NULL AND snapshot.state <> ?
				ORDER BY snapshot."organizationId", coalesce(snapshot.ref, snapshot.id::text), snapshot.size DESC
			) image
			UNION ALL
			SELECT backup."organizationId",
				coalesce(backup."packSizeBytes", 0) + coalesce(backup."manifestSizeBytes", 0)
			FROM volume_backup backup
			WHERE backup.state = ?
			UNION ALL
			SELECT sandbox."organizationId", sandbox."backupSizeBytes"
			FROM sandbox
			WHERE sandbox.state = ? AND sandbox."backupSizeBytes" IS NOT NULL
		)
		SELECT stored."organizationId", sum(stored.bytes)::text AS "storedBytes"
		FROM stored
		JOIN organization ON organization.id = stored."organizationId"
		WHERE organization."deletedAt" IS NULL
		  AND (?::uuid IS NULL OR stored."organizationId" = ?::uuid)
		GROUP BY stored."organizationId"
		HAVING sum(stored.bytes) > 0
		ORDER BY stored."organizationId"`,
		[
			BYTES_PER_GIBIBYTE.toString(),
			SnapshotState.REMOVING,
			VolumeBackupState.COMPLETED,
			SandboxState.ARCHIVED,
			organizationId,
			organizationId,
		]
	);
	return rows.map((row) => ({
		organizationId: row.organizationId,
		storedBytes: BigInt(row.storedBytes),
	}));
}
