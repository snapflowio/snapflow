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
import { VOLUME_BACKUP } from '../constants/volume-backup.constants';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import {
	FAKE_VOLUME_SIZE_BYTES,
	fakeVolumeBackup,
} from '../testing/volume-backup.fake';
import { selectBackupBase } from './volume-backup-chain.util';

const LATEST_GENERATION = 7;
const RESIZED_VOLUME_BYTES = String(2 * VOLUME_BACKUP.BYTES_PER_GIB);

describe('selectBackupBase', () => {
	it('starts a full backup when the volume has no completed backup', () => {
		assert.deepEqual(selectBackupBase(null, FAKE_VOLUME_SIZE_BYTES), {
			base: null,
			chainDepth: VOLUME_BACKUP.FULL_CHAIN_DEPTH,
		});
	});

	it('chains onto the latest completed backup one level deeper', () => {
		const latest = fakeVolumeBackup(LATEST_GENERATION, { chainDepth: 4 });

		const link = selectBackupBase(latest, FAKE_VOLUME_SIZE_BYTES);

		assert.equal(link.base, latest);
		assert.equal(link.chainDepth, 5);
	});

	it('forces a full backup once the chain reaches MAX_CHAIN_DEPTH', () => {
		const deepest = fakeVolumeBackup(LATEST_GENERATION, {
			chainDepth: VOLUME_BACKUP.MAX_CHAIN_DEPTH - 1,
		});
		const atLimit = selectBackupBase(deepest, FAKE_VOLUME_SIZE_BYTES);
		assert.equal(atLimit.chainDepth, VOLUME_BACKUP.MAX_CHAIN_DEPTH);

		const tooDeep = selectBackupBase(
			fakeVolumeBackup(LATEST_GENERATION, {
				chainDepth: VOLUME_BACKUP.MAX_CHAIN_DEPTH,
			}),
			FAKE_VOLUME_SIZE_BYTES
		);
		assert.deepEqual(tooDeep, {
			base: null,
			chainDepth: VOLUME_BACKUP.FULL_CHAIN_DEPTH,
		});
	});

	it('forces a full backup after a resize or when the base is not restorable', () => {
		const latest = fakeVolumeBackup(LATEST_GENERATION);
		assert.equal(selectBackupBase(latest, RESIZED_VOLUME_BYTES).base, null);
		assert.equal(
			selectBackupBase(
				fakeVolumeBackup(LATEST_GENERATION, { prunedAt: new Date() }),
				FAKE_VOLUME_SIZE_BYTES
			).base,
			null
		);
		assert.equal(
			selectBackupBase(
				fakeVolumeBackup(LATEST_GENERATION, { state: VolumeBackupState.ERROR }),
				FAKE_VOLUME_SIZE_BYTES
			).base,
			null
		);
	});
});
