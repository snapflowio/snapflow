/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { EntityName } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../common/testing/instance.fake';
import { ObjectStorageService } from '../../object-storage/services/object-storage.service';
import { Volume } from '../entities/volume.entity';
import { VolumeBackup } from '../entities/volume-backup.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import {
	FAKE_ORGANIZATION_ID,
	FAKE_VOLUME_ID,
	fakeArtifactId,
	fakeVolumeBackup,
} from '../testing/volume-backup.fake';
import { volumeBackupObjectKeys } from '../utils/volume-backup-object-key.util';
import { VolumeBackupService } from './volume-backup.service';
import { VolumeBackupDataKeyService } from './volume-backup-data-key.service';

const SANDBOX_ID = '2b000000-0000-4000-8000-000000000002';
const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const FENCING_TOKEN = '5e000000-0000-4000-8000-000000000005';
const ATTACHMENT_GENERATION = 2;
const LATEST_GENERATION = 3;
const STORAGE_ORIGIN = 'https://storage.invalid/';

function signedUrl(objectKey: string): string {
	return `${STORAGE_ORIGIN}${objectKey}`;
}

function dataKeyOf(backup: Pick<VolumeBackup, 'artifactId'>): string {
	return `key-${backup.artifactId}`;
}

function volumeAt(latest: VolumeBackup): Volume {
	return Object.assign(new Volume(), {
		id: FAKE_VOLUME_ID,
		organizationId: FAKE_ORGANIZATION_ID,
		sizeGiB: 1,
		activeAttachmentId: SANDBOX_ID,
		activeMachineId: MACHINE_ID,
		fencingToken: FENCING_TOKEN,
		attachmentGeneration: ATTACHMENT_GENERATION,
		backupArtifactId: latest.artifactId,
		backupGeneration: latest.backupGeneration,
	});
}

/** Three generations: 1 full, 2 and 3 incremental; 3 still references 1 and 3. */
function history(): VolumeBackup[] {
	return [1, 2, 3].map((generation) =>
		fakeVolumeBackup(generation, {
			baseArtifactId: generation > 1 ? fakeArtifactId(generation - 1) : null,
			chainDepth: generation - 1,
			referencedArtifactIds:
				generation === LATEST_GENERATION
					? [fakeArtifactId(1), fakeArtifactId(LATEST_GENERATION)]
					: [fakeArtifactId(generation)],
		})
	);
}

function setup(backups: VolumeBackup[]) {
	const latest = backups[backups.length - 1];
	const volume = volumeAt(latest);
	const manager = fakeInstance(EntityManager);
	mock.method(
		manager,
		'transactional',
		async (work: (em: EntityManager) => unknown) => work(manager)
	);
	mock.method(manager, 'findOne', async (entity: EntityName<object>) =>
		entity === Volume ? volume : latest
	);
	mock.method(
		manager,
		'find',
		async (
			entity: EntityName<object>,
			where: { artifactId?: { $in: string[] }; state?: VolumeBackupState }
		) => {
			if (entity === Volume) return [volume];
			if (where.state === VolumeBackupState.PENDING) return [];
			const wanted = new Set(where.artifactId?.$in ?? []);
			return backups.filter((backup) => wanted.has(backup.artifactId));
		}
	);
	mock.method(manager, 'execute', async () => [
		{ volumeId: FAKE_VOLUME_ID, maximum: LATEST_GENERATION },
	]);
	mock.method(manager, 'create', (_entity: unknown, data: object) =>
		Object.assign(new VolumeBackup(), data)
	);
	mock.method(manager, 'persist', () => manager);

	const storage = fakeInstance(ObjectStorageService);
	mock.method(storage, 'createVolumeBackupUpload', async (key: string) =>
		signedUrl(key)
	);
	mock.method(storage, 'createVolumeBackupDownload', async (key: string) =>
		signedUrl(key)
	);
	const dataKeys = fakeInstance(VolumeBackupDataKeyService);
	mock.method(dataKeys, 'encrypt', () => 'ciphertext');
	mock.method(dataKeys, 'decrypt', dataKeyOf);

	return {
		latest,
		service: new VolumeBackupService(manager, storage, dataKeys),
	};
}

describe('VolumeBackupService', () => {
	it('presigns the pack and manifest of a new backup and bases it on the latest backup', async () => {
		const { latest, service } = setup(history());

		const [request] = await service.prepareForSandbox(
			SANDBOX_ID,
			MACHINE_ID,
			FAKE_ORGANIZATION_ID,
			[FAKE_VOLUME_ID]
		);

		const keys = volumeBackupObjectKeys({
			organizationId: FAKE_ORGANIZATION_ID,
			volumeId: FAKE_VOLUME_ID,
			artifactId: request.artifactId,
		});
		assert.equal(request.packUploadUrl, signedUrl(keys.pack));
		assert.equal(request.manifestUploadUrl, signedUrl(keys.manifest));
		assert.equal(request.backupGeneration, LATEST_GENERATION + 1);
		assert.equal(request.dataKey, dataKeyOf(request));
		assert.equal(request.fencingToken, FENCING_TOKEN);
		assert.equal(request.base?.artifactId, latest.artifactId);
		assert.equal(
			request.base?.downloadUrl,
			signedUrl(volumeBackupObjectKeys(latest).manifest)
		);
		assert.equal(request.base?.dataKey, dataKeyOf(latest));
	});

	it('restores from the manifest and every pack it references', async () => {
		const backups = history();
		const { latest, service } = setup(backups);

		const restore = await service.createRestoreRequest(FAKE_VOLUME_ID);

		assert.deepEqual(restore.manifest?.artifactId, latest.artifactId);
		assert.equal(
			restore.manifest?.downloadUrl,
			signedUrl(volumeBackupObjectKeys(latest).manifest)
		);
		assert.deepEqual(
			restore.packs.map(({ artifactId, downloadUrl, dataKey }) => ({
				artifactId,
				downloadUrl,
				dataKey,
			})),
			[backups[0], latest].map((pack) => ({
				artifactId: pack.artifactId,
				downloadUrl: signedUrl(volumeBackupObjectKeys(pack).pack),
				dataKey: dataKeyOf(pack),
			}))
		);
		assert.equal(
			restore.expectedVolumeSizeBytes,
			BigInt(latest.expectedVolumeSizeBytes)
		);
	});

	it('refuses a restore whose referenced pack is gone', async () => {
		const backups = history();
		const { service } = setup(backups.slice(1));

		await assert.rejects(
			service.createRestoreRequest(FAKE_VOLUME_ID),
			/references missing pack/
		);
	});
});
