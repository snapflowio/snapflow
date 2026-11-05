/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { create } from '@bufbuild/protobuf';
import {
	type FilterQuery,
	LockMode,
	TransactionPropagation,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
	type RestoreVolumeBackup,
	RestoreVolumeBackupSchema,
	type VolumeBackupObject,
	VolumeBackupObjectSchema,
	type VolumeBackupRequest,
	VolumeBackupRequestSchema,
	type VolumeBackupResult,
} from '@snapflow/machine-proto';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { ENCRYPTION_ENVELOPE_VERSION } from '../../infra/encryption/constants/encryption.constants';
import type { Job } from '../../machine-job/entities/job.entity';
import { JobStatus } from '../../machine-job/enums/job-status.enum';
import { ObjectStorageService } from '../../object-storage/services/object-storage.service';
import { VOLUME_BACKUP } from '../constants/volume-backup.constants';
import { Volume } from '../entities/volume.entity';
import { VolumeBackup } from '../entities/volume-backup.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import {
	selectBackupBase,
	type VolumeBackupChainLink,
} from '../utils/volume-backup-chain.util';
import {
	assertActiveBackupFence,
	assertBackupMatchesRequest,
	assertBackupResult,
	backupFenceKey,
	backupFenceMatches,
} from '../utils/volume-backup-fence.util';
import {
	type VolumeBackupObjectKeys,
	volumeBackupObjectKeys,
} from '../utils/volume-backup-object-key.util';
import { VolumeBackupDataKeyService } from './volume-backup-data-key.service';

export type VolumeBackupJob = Pick<
	Job,
	'resourceId' | 'machineId' | 'status' | 'errorMessage'
>;

type FencedVolume = Volume & { fencingToken: string };

interface SettledBackup {
	job: VolumeBackupJob;
	request: VolumeBackupRequest;
	backup: VolumeBackup;
	volume: Volume;
}

function expectedVolumeSizeBytes(volume: Pick<Volume, 'sizeGiB'>): string {
	return String(volume.sizeGiB * VOLUME_BACKUP.BYTES_PER_GIB);
}

function settledBackup(
	job: VolumeBackupJob,
	request: VolumeBackupRequest,
	backupByArtifactId: ReadonlyMap<string, VolumeBackup>,
	volumeById: ReadonlyMap<string, Volume>
): SettledBackup | null {
	const backup = backupByArtifactId.get(request.artifactId);
	if (!backup) {
		throw new Error(`Volume backup ${request.artifactId} was not found`);
	}
	if (backup.state === VolumeBackupState.COMPLETED) {
		return null;
	}
	assertBackupMatchesRequest(backup, request, job.resourceId, job.machineId);
	const volume = volumeById.get(request.volumeId);
	if (!volume) {
		throw new Error(`Volume ${request.volumeId} was not found`);
	}
	return { job, request, backup, volume };
}

function fenceMatches({ job, request, volume }: SettledBackup): boolean {
	return backupFenceMatches(volume, request, job.resourceId, job.machineId);
}

function applyFailedBackup(settled: SettledBackup): void {
	const { job, backup, volume } = settled;
	backup.state = VolumeBackupState.ERROR;
	backup.errorReason = job.errorMessage ?? VOLUME_BACKUP.FAILED_REASON;
	if (fenceMatches(settled)) {
		volume.backupState = VolumeBackupState.ERROR;
	}
}

function assertReferencedPacks(
	result: VolumeBackupResult,
	completedById: ReadonlyMap<string, VolumeBackup>
): void {
	for (const artifactId of result.referencedArtifactIds) {
		if (artifactId === result.artifactId) continue;
		if (completedById.get(artifactId)?.volumeId !== result.volumeId) {
			throw new Error(
				`Volume backup ${result.artifactId} references unknown pack ${artifactId}`
			);
		}
	}
}

function applyCompletedBackup(
	settled: SettledBackup,
	result: VolumeBackupResult | undefined,
	completedById: ReadonlyMap<string, VolumeBackup>,
	completedAt: Date
): void {
	const { request, backup, volume } = settled;
	if (!fenceMatches(settled)) {
		throw new Error(
			`Volume ${volume.id} attachment changed before backup completion`
		);
	}
	if (!result) {
		throw new Error(
			`Volume backup result ${request.artifactId} was not returned`
		);
	}
	assertBackupResult(result, request);
	assertReferencedPacks(result, completedById);
	backup.state = VolumeBackupState.COMPLETED;
	backup.packSizeBytes = result.packSizeBytes.toString();
	backup.manifestSizeBytes = result.manifestSizeBytes.toString();
	backup.changedBytes = result.changedBytes.toString();
	backup.referencedArtifactIds = result.referencedArtifactIds;
	backup.completedAt = completedAt;
	backup.errorReason = null;
	volume.generation = request.backupGeneration;
	volume.backupArtifactId = request.artifactId;
	volume.backupGeneration = request.backupGeneration;
	volume.backupState = VolumeBackupState.COMPLETED;
	volume.lastBackupAt = completedAt;
}

@Injectable()
export class VolumeBackupService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly objectStorageService: ObjectStorageService,
		private readonly dataKeys: VolumeBackupDataKeyService
	) {}

	async prepareForSandbox(
		sandboxId: string,
		machineId: string,
		organizationId: string,
		volumeIds: string[]
	): Promise<VolumeBackupRequest[]> {
		const uniqueVolumeIds = [...new Set(volumeIds)];
		if (uniqueVolumeIds.length === 0) {
			return [];
		}

		return this.entityManager.transactional(
			async (manager) => {
				const { volumes, backups } = await this.lockBackupBatch(
					manager,
					uniqueVolumeIds,
					{
						volumeId: { $in: uniqueVolumeIds },
						sandboxId,
						machineId,
						state: VolumeBackupState.PENDING,
					}
				);
				if (volumes.length !== uniqueVolumeIds.length) {
					throw new Error('One or more volumes disappeared before backup');
				}
				const maximumByVolumeId = await this.maximumBackupGenerations(
					manager,
					uniqueVolumeIds
				);
				const baseById = await this.baseCandidates(manager, volumes, backups);
				const existingBackupByFence = new Map(
					backups.map((backup) => [
						backupFenceKey(
							backup.volumeId,
							backup.attachmentGeneration,
							backup.fencingToken
						),
						backup,
					])
				);
				const requests: VolumeBackupRequest[] = [];
				for (const volume of volumes) {
					assertActiveBackupFence(volume, sandboxId, machineId, organizationId);
					const existing = existingBackupByFence.get(
						backupFenceKey(
							volume.id,
							volume.attachmentGeneration,
							volume.fencingToken
						)
					);
					const link = existing
						? this.existingChainLink(existing, baseById)
						: selectBackupBase(
								volume.backupArtifactId
									? baseById.get(volume.backupArtifactId)
									: null,
								expectedVolumeSizeBytes(volume)
							);
					const backup =
						existing ??
						this.createPendingBackup(
							manager,
							volume,
							sandboxId,
							machineId,
							organizationId,
							maximumByVolumeId.get(volume.id) ?? volume.backupGeneration ?? 0,
							link
						);
					requests.push(await this.backupRequest(volume, backup, link.base));
					volume.backupState = VolumeBackupState.PENDING;
				}
				return requests;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async applyJobCompletion(
		job: VolumeBackupJob,
		requests: readonly VolumeBackupRequest[],
		results: readonly VolumeBackupResult[]
	): Promise<void> {
		if (requests.length === 0) {
			return;
		}

		await this.entityManager.transactional(
			async (manager) => {
				const { volumes, backups } = await this.lockBackupBatch(
					manager,
					[...new Set(requests.map(({ volumeId }) => volumeId))],
					{ artifactId: { $in: requests.map(({ artifactId }) => artifactId) } }
				);
				const backupByArtifactId = new Map(
					backups.map((backup) => [backup.artifactId, backup])
				);
				const volumeById = new Map(
					volumes.map((volume) => [volume.id, volume])
				);
				const resultByArtifactId = new Map(
					results.map((result) => [result.artifactId, result])
				);
				const completedById = await this.completedBackups(
					manager,
					results.flatMap((result) => result.referencedArtifactIds)
				);
				const completedAt = await databaseNow(manager);
				for (const request of requests) {
					const settled = settledBackup(
						job,
						request,
						backupByArtifactId,
						volumeById
					);
					if (!settled) {
						continue;
					}
					if (job.status === JobStatus.FAILED) {
						applyFailedBackup(settled);
					} else {
						applyCompletedBackup(
							settled,
							resultByArtifactId.get(request.artifactId),
							completedById,
							completedAt
						);
					}
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async createRestoreRequest(volumeId: string): Promise<RestoreVolumeBackup> {
		const volume = await this.entityManager.findOne(Volume, { id: volumeId });
		if (!volume?.backupArtifactId) {
			throw new Error(`Volume ${volumeId} has no completed portable backup`);
		}
		const backup = await this.entityManager.findOne(VolumeBackup, {
			artifactId: volume.backupArtifactId,
			volumeId,
			state: VolumeBackupState.COMPLETED,
			prunedAt: null,
		});
		if (!backup) {
			throw new Error(`Volume backup ${volume.backupArtifactId} is incomplete`);
		}
		const packById = await this.completedBackups(
			this.entityManager,
			backup.referencedArtifactIds
		);
		const packs = backup.referencedArtifactIds.map((artifactId) => {
			const pack = packById.get(artifactId);
			if (pack?.volumeId !== volumeId) {
				throw new Error(
					`Volume backup ${backup.artifactId} references missing pack ${artifactId}`
				);
			}
			return pack;
		});
		return create(RestoreVolumeBackupSchema, {
			manifest: await this.backupObject(backup, 'manifest'),
			packs: await Promise.all(
				packs.map((pack) => this.backupObject(pack, 'pack'))
			),
			expectedVolumeSizeBytes: BigInt(backup.expectedVolumeSizeBytes),
		});
	}

	private existingChainLink(
		backup: VolumeBackup,
		baseById: ReadonlyMap<string, VolumeBackup>
	): VolumeBackupChainLink {
		if (!backup.baseArtifactId) {
			return { base: null, chainDepth: backup.chainDepth };
		}
		const base = baseById.get(backup.baseArtifactId);
		if (!base) {
			throw new Error(
				`Base ${backup.baseArtifactId} of volume backup ${backup.artifactId} was not found`
			);
		}
		return { base, chainDepth: backup.chainDepth };
	}

	private async baseCandidates(
		manager: EntityManager,
		volumes: readonly Volume[],
		pendingBackups: readonly VolumeBackup[]
	): Promise<Map<string, VolumeBackup>> {
		const artifactIds = [
			...volumes.flatMap((volume) =>
				volume.backupArtifactId ? [volume.backupArtifactId] : []
			),
			...pendingBackups.flatMap((backup) =>
				backup.baseArtifactId ? [backup.baseArtifactId] : []
			),
		];
		return this.completedBackups(manager, artifactIds);
	}

	private async completedBackups(
		manager: EntityManager,
		artifactIds: readonly string[]
	): Promise<Map<string, VolumeBackup>> {
		const uniqueIds = [...new Set(artifactIds)];
		if (uniqueIds.length === 0) {
			return new Map();
		}
		const backups = await manager.find(VolumeBackup, {
			artifactId: { $in: uniqueIds },
			state: VolumeBackupState.COMPLETED,
		});
		return new Map(backups.map((backup) => [backup.artifactId, backup]));
	}

	private async lockBackupBatch(
		manager: EntityManager,
		volumeIds: readonly string[],
		backupWhere: FilterQuery<VolumeBackup>
	): Promise<{ volumes: Volume[]; backups: VolumeBackup[] }> {
		const volumes = await manager.find(
			Volume,
			{ id: { $in: [...volumeIds] } },
			{ orderBy: { id: 'ASC' }, lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const backups = await manager.find(VolumeBackup, backupWhere, {
			orderBy: { volumeId: 'ASC', backupGeneration: 'DESC' },
			lockMode: LockMode.PESSIMISTIC_WRITE,
		});
		return { volumes, backups };
	}

	private async maximumBackupGenerations(
		manager: EntityManager,
		volumeIds: readonly string[]
	): Promise<Map<string, number>> {
		const rows = await manager.execute<{ volumeId: string; maximum: number }[]>(
			`SELECT "volumeId", MAX("backupGeneration")::integer AS maximum
			 FROM "volume_backup"
			 WHERE "volumeId" IN (${volumeIds.map(() => '?').join(', ')})
			 GROUP BY "volumeId"`,
			[...volumeIds]
		);
		return new Map(rows.map((row) => [row.volumeId, row.maximum]));
	}

	private async backupObject(
		backup: VolumeBackup,
		object: keyof VolumeBackupObjectKeys
	): Promise<VolumeBackupObject> {
		return create(VolumeBackupObjectSchema, {
			artifactId: backup.artifactId,
			downloadUrl: await this.objectStorageService.createVolumeBackupDownload(
				volumeBackupObjectKeys(backup)[object]
			),
			dataKey: this.dataKeys.decrypt(backup),
		});
	}

	private async backupRequest(
		volume: FencedVolume,
		backup: VolumeBackup,
		base: VolumeBackup | null
	): Promise<VolumeBackupRequest> {
		const keys = volumeBackupObjectKeys(backup);
		const [packUploadUrl, manifestUploadUrl, baseObject] = await Promise.all([
			this.objectStorageService.createVolumeBackupUpload(keys.pack),
			this.objectStorageService.createVolumeBackupUpload(keys.manifest),
			base ? this.backupObject(base, 'manifest') : undefined,
		]);
		return create(VolumeBackupRequestSchema, {
			volumeId: volume.id,
			artifactId: backup.artifactId,
			packUploadUrl,
			manifestUploadUrl,
			dataKey: this.dataKeys.decrypt(backup),
			attachmentGeneration: volume.attachmentGeneration,
			fencingToken: volume.fencingToken,
			backupGeneration: backup.backupGeneration,
			base: baseObject,
		});
	}

	private createPendingBackup(
		manager: EntityManager,
		volume: FencedVolume,
		sandboxId: string,
		machineId: string,
		organizationId: string,
		maximumGeneration: number,
		link: VolumeBackupChainLink
	): VolumeBackup {
		const backupGeneration = maximumGeneration + 1;
		const artifactId = randomUUID();
		const dataKey = randomBytes(VOLUME_BACKUP.DATA_KEY_BYTES);
		try {
			const now = new Date();
			const backup = manager.create(VolumeBackup, {
				artifactId,
				volumeId: volume.id,
				organizationId,
				sandboxId,
				machineId,
				backupGeneration,
				attachmentGeneration: volume.attachmentGeneration,
				fencingToken: volume.fencingToken,
				baseArtifactId: link.base?.artifactId ?? null,
				chainDepth: link.chainDepth,
				dataKeyCiphertext: this.dataKeys.encrypt(
					dataKey,
					organizationId,
					artifactId,
					backupGeneration
				),
				dataKeyEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
				state: VolumeBackupState.PENDING,
				packSizeBytes: null,
				manifestSizeBytes: null,
				changedBytes: null,
				referencedArtifactIds: [],
				expectedVolumeSizeBytes: expectedVolumeSizeBytes(volume),
				errorReason: null,
				completedAt: null,
				prunedAt: null,
				createdAt: now,
				updatedAt: now,
			});
			manager.persist(backup);
			return backup;
		} finally {
			dataKey.fill(0);
		}
	}
}
