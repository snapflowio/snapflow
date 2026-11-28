/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
} from '@nestjs/common';
import { VOLUME_CREATION_LOCK_NAMESPACE } from '../../common/constants/advisory-lock.constants';
import { apiError } from '../../common/utils/error/api-error.util';
import { OrganizationService } from '../../organization/services/organization.service';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import { CreateVolumeDto } from '../dto/create-volume.dto';
import { Volume } from '../entities/volume.entity';
import { VolumeErrorCode } from '../enums/volume-error-code.enum';
import { VolumeState } from '../enums/volume-state.enum';
import { VolumeNotFoundException } from '../exceptions/volume-not-found.exception';
import { VolumeManager } from '../managers/volume.manager';

const DEFAULT_VOLUME_FILESYSTEM = 'ext4';

@Injectable()
export class VolumeProvisioningService {
	private readonly logger = new Logger(VolumeProvisioningService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly organizations: OrganizationService,
		private readonly volumeManager: VolumeManager
	) {}

	async create(
		organizationId: string,
		createVolumeDto: CreateVolumeDto,
		manager?: EntityManager
	): Promise<Volume> {
		const persist = async (entityManager: EntityManager): Promise<Volume> => {
			await entityManager.execute(
				'SELECT pg_advisory_xact_lock(hashtextextended(?, ?))',
				[organizationId, VOLUME_CREATION_LOCK_NAMESPACE]
			);
			await this.organizations.assertActive(organizationId);
			const volume = new Volume();

			volume.id = randomUUID();

			volume.name = createVolumeDto.name || volume.id;

			const existingVolume = await entityManager.findOne(Volume, {
				organizationId,
				name: volume.name,
				state: { $ne: VolumeState.DELETED },
			});

			if (existingVolume) {
				throw new BadRequestException(
					apiError(
						VolumeErrorCode.NAME_TAKEN,
						`A volume named ${volume.name} already exists. Choose another name.`
					)
				);
			}

			volume.organizationId = organizationId;
			volume.sizeGiB = createVolumeDto.sizeGiB;
			volume.filesystem = DEFAULT_VOLUME_FILESYSTEM;
			volume.generation = 1;
			volume.attachmentGeneration = 0;
			volume.state = VolumeState.READY;
			volume.createdAt = new Date();
			volume.updatedAt = volume.createdAt;

			entityManager.persist(volume);
			this.logger.debug(
				`Created volume ${volume.id} for organization ${organizationId}`
			);
			return volume;
		};
		return manager
			? persist(manager)
			: this.entityManager.transactional(persist, {
					propagation: TransactionPropagation.REQUIRED,
				});
	}

	async delete(volumeId: string): Promise<void> {
		const volume = await this.entityManager.findOne(Volume, {
			id: volumeId,
		});

		if (!volume) {
			throw new VolumeNotFoundException(volumeId);
		}

		if (
			volume.state !== VolumeState.READY &&
			volume.state !== VolumeState.ERROR
		) {
			throw new BadRequestException(
				apiError(
					VolumeErrorCode.NOT_READY,
					`The volume is busy and can only be deleted when it is ${VolumeState.READY} or ${VolumeState.ERROR}. Wait for its current operation to finish, then try again.`
				)
			);
		}

		const sandboxUsingVolume = await this.entityManager
			.createQueryBuilder(Sandbox, 'sandbox')
			.where({ organizationId: volume.organizationId })
			.andWhere('sandbox.volumes @> ?::jsonb', [JSON.stringify([{ volumeId }])])
			.andWhere({ desiredState: { $ne: SandboxDesiredState.DESTROYED } })
			.select(['sandbox.id', 'sandbox.name'])
			.getSingleResult();

		if (sandboxUsingVolume) {
			throw new ConflictException(
				apiError(
					VolumeErrorCode.IN_USE,
					`The volume is used by sandbox ${sandboxUsingVolume.name}. Detach it from every sandbox, then delete it.`
				)
			);
		}

		if (volume.activeAttachmentId) {
			throw new ConflictException(
				apiError(
					VolumeErrorCode.IN_USE,
					'The volume is still attached to a sandbox that is shutting down. Wait for the sandbox to stop, then delete the volume.'
				)
			);
		}

		volume.state = VolumeState.PENDING_DELETE;
		await this.entityManager.flush();
		this.logger.debug(`Marked volume ${volumeId} for deletion`);
		await this.volumeManager.scheduleDeletion(volumeId);
	}
}
