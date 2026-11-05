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
	NotFoundException,
} from '@nestjs/common';
import { VOLUME_CREATION_LOCK_NAMESPACE } from '../../../common/constants/advisory-lock.constants';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { CreateVolumeDto } from '../dto/create-volume.dto';
import { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';
import { VolumeManager } from '../managers/volume.manager';

const DEFAULT_VOLUME_FILESYSTEM = 'ext4';

@Injectable()
export class VolumeProvisioningService {
	private readonly logger = new Logger(VolumeProvisioningService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly organizationLimitsService: OrganizationLimitsService,
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
			const { volumeQuota } =
				await this.organizationLimitsService.get(organizationId);
			const currentVolumeCount = await entityManager.count(Volume, {
				organizationId,
				state: { $ne: VolumeState.DELETED },
			});
			if (currentVolumeCount >= volumeQuota) {
				throw new BadRequestException(
					`Volume quota exceeded. Maximum allowed: ${volumeQuota}`
				);
			}
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
					`Volume with name ${volume.name} already exists`
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
			throw new NotFoundException(`Volume with ID ${volumeId} not found`);
		}

		if (
			volume.state !== VolumeState.READY &&
			volume.state !== VolumeState.ERROR
		) {
			throw new BadRequestException(
				`Volume must be in '${VolumeState.READY}' or '${VolumeState.ERROR}' state in order to be deleted`
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
				`Volume cannot be deleted because it is in use by one or more sandboxes (e.g. ${sandboxUsingVolume.name})`
			);
		}

		volume.state = VolumeState.PENDING_DELETE;
		await this.entityManager.flush();
		this.logger.debug(`Marked volume ${volumeId} for deletion`);
		await this.volumeManager.scheduleDeletion(volumeId);
	}
}
