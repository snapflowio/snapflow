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
import {
	FAKE_ORGANIZATION_ID,
	FAKE_VOLUME_ID,
	fakeVolumeBackup,
} from '../testing/volume-backup.fake';
import {
	volumeBackupObjectKeys,
	volumeBackupPrefix,
} from './volume-backup-object-key.util';

describe('volume backup object keys', () => {
	it('keeps the pack and manifest of a backup under the volume prefix', () => {
		const backup = fakeVolumeBackup(1);
		const prefix = `${FAKE_ORGANIZATION_ID}/volume-backups/${FAKE_VOLUME_ID}/`;

		assert.equal(volumeBackupPrefix(backup), prefix);
		assert.deepEqual(volumeBackupObjectKeys(backup), {
			pack: `${prefix}${backup.artifactId}.pack`,
			manifest: `${prefix}${backup.artifactId}.manifest`,
		});
	});
});
