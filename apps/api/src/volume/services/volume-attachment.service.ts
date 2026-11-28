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
import { apiError } from '../../common/utils/error/api-error.util';
import { Volume } from '../entities/volume.entity';
import { VolumeErrorCode } from '../enums/volume-error-code.enum';
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
			apiError(
				VolumeErrorCode.NOT_READY,
				`Volume ${volume.id} is not ready yet. Wait until it is ready, then attach it.`
			)
		);
	}
	if (isHeldBy(volume, claim)) {
		return;
	}
	if (volume.activeAttachmentId) {
		throw new ConflictException(
			apiError(
				VolumeErrorCode.IN_USE,
				`Volume ${volume.id} is attached to another sandbox. Detach it there first.`
			)
		);
	}
	if (volume.homeMachineId && volume.homeMachineId !== claim.machineId) {
		throw new ConflictException(
			apiError(
				VolumeErrorCode.PINNED_TO_MACHINE,
				`Volume ${volume.id} is stored on machine ${volume.homeMachineId}. Place the sandbox on that machine, or restore the volume from a backup to move it.`
			)
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
						apiError(
							VolumeErrorCode.NOT_FOUND,
							'One or more volumes were not found. Check the volume IDs or names; they may have been deleted.'
						)
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

	async releaseAttachments(
		manager: EntityManager,
		sandboxId: string
	): Promise<void> {
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
	}
}
