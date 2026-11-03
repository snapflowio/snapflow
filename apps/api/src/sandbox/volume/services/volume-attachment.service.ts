/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';

interface AttachmentClaim {
	sandboxId: string;
	machineId: string;
}

function isHeldBy(volume: Volume, claim: AttachmentClaim): boolean {
	return (
		volume.activeAttachmentId === claim.sandboxId &&
		volume.activeMachineId === claim.machineId &&
		Boolean(volume.fencingToken)
	);
}

function claimVolume(volume: Volume, claim: AttachmentClaim): void {
	if (volume.state !== VolumeState.READY) {
		throw new ConflictException(
			`Volume ${volume.id} is not ready for attachment`
		);
	}
	if (isHeldBy(volume, claim)) {
		return;
	}
	if (volume.activeAttachmentId) {
		throw new ConflictException(
			`Volume ${volume.id} is attached to another sandbox`
		);
	}
	if (volume.homeMachineId && volume.homeMachineId !== claim.machineId) {
		throw new ConflictException(
			`Volume ${volume.id} lives on machine ${volume.homeMachineId}; restore it to move it`
		);
	}
	volume.homeMachineId = claim.machineId;
	volume.activeAttachmentId = claim.sandboxId;
	volume.activeMachineId = claim.machineId;
	volume.attachmentGeneration += 1;
	volume.fencingToken = randomUUID();
}

@Injectable()
export class VolumeAttachmentService {
	constructor(private readonly entityManager: EntityManager) {}

	async claimAttachments(
		sandboxId: string,
		machineId: string,
		volumeIds: string[]
	): Promise<Map<string, Volume>> {
		const uniqueVolumeIds = [...new Set(volumeIds)];
		if (uniqueVolumeIds.length === 0) {
			return new Map();
		}

		return this.entityManager.transactional(
			async (manager) => {
				const volumes = await manager.find(
					Volume,
					{ id: { $in: uniqueVolumeIds } },
					{
						orderBy: { id: 'ASC' },
						lockMode: LockMode.PESSIMISTIC_WRITE,
					}
				);
				if (volumes.length !== uniqueVolumeIds.length) {
					throw new NotFoundException(
						'One or more persistent volumes were not found'
					);
				}

				for (const volume of volumes) {
					claimVolume(volume, { sandboxId, machineId });
				}
				return new Map(volumes.map((volume) => [volume.id, volume]));
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async releaseAttachments(sandboxId: string): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const volumes = await manager.find(
					Volume,
					{ activeAttachmentId: sandboxId },
					{ orderBy: { id: 'ASC' }, lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				for (const volume of volumes) {
					volume.activeAttachmentId = null;
					volume.activeMachineId = null;
					volume.fencingToken = null;
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}
