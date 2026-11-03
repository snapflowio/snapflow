/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import {
	fakeArtifactId,
	fakeVolumeBackup,
} from '../testing/volume-backup.fake';
import { planVolumeBackupRetention } from './volume-backup-retention.util';

function ids(backups: readonly { artifactId: string }[]): string[] {
	return backups.map(({ artifactId }) => artifactId).sort();
}

/** Generation 1 is full; each later one chains on its predecessor. */
function chain(length: number) {
	return [...Array(length).keys()].map((index) => {
		const generation = index + 1;
		return fakeVolumeBackup(generation, {
			baseArtifactId: generation > 1 ? fakeArtifactId(generation - 1) : null,
			chainDepth: index,
			referencedArtifactIds: [...Array(generation).keys()].map((ref) =>
				fakeArtifactId(ref + 1)
			),
		});
	});
}

describe('planVolumeBackupRetention', () => {
	it('keeps packs that retained backups still reference and drops only their manifests', () => {
		const backups = chain(6);
		const latest = backups[5];

		const plan = planVolumeBackupRetention(
			{ backupArtifactId: latest.artifactId },
			backups
		);

		assert.deepEqual(ids(plan.pruneManifests), ids(backups.slice(0, 3)));
		assert.deepEqual(plan.deleteBackups, []);
	});

	it('deletes packs nothing retained references', () => {
		const backups = chain(3);
		const fullRestart = [4, 5, 6].map((generation) =>
			fakeVolumeBackup(generation, {
				referencedArtifactIds: [fakeArtifactId(generation)],
			})
		);

		const plan = planVolumeBackupRetention(
			{ backupArtifactId: fullRestart[2].artifactId },
			[...backups, ...fullRestart]
		);

		assert.deepEqual(ids(plan.deleteBackups), ids(backups));
		assert.deepEqual(plan.pruneManifests, []);
	});

	it('does not prune a manifest twice and deletes failed backups', () => {
		const backups = chain(5);
		backups[0].prunedAt = new Date();
		const failed = fakeVolumeBackup(6, {
			state: VolumeBackupState.ERROR,
			referencedArtifactIds: [],
		});

		const plan = planVolumeBackupRetention(
			{ backupArtifactId: backups[4].artifactId },
			[...backups, failed]
		);

		assert.deepEqual(ids(plan.pruneManifests), ids([backups[1]]));
		assert.deepEqual(ids(plan.deleteBackups), ids([failed]));
	});

	it('keeps the base of an in-flight backup and the restore target', () => {
		const backups = chain(6).map((backup) =>
			Object.assign(backup, { referencedArtifactIds: [backup.artifactId] })
		);
		const pending = fakeVolumeBackup(7, {
			state: VolumeBackupState.PENDING,
			baseArtifactId: backups[0].artifactId,
			referencedArtifactIds: [],
		});

		const plan = planVolumeBackupRetention(
			{ backupArtifactId: backups[1].artifactId },
			[...backups, pending]
		);

		assert.deepEqual(ids(plan.deleteBackups), ids([backups[2]]));
		assert.deepEqual(plan.pruneManifests, []);
	});
});
