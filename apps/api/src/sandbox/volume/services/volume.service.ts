/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { CursorPage } from '../../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { isValidUuid } from '../../../common/utils/uuid.util';
import { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';

function resolveVolumeReference(
	idOrName: string,
	volumesById: ReadonlyMap<string, Volume>,
	volumesByName: ReadonlyMap<string, Volume>
): Volume {
	const matchedById = isValidUuid(idOrName)
		? volumesById.get(idOrName.toLowerCase())
		: undefined;
	const matchedByName = volumesByName.get(idOrName);
	if (matchedById && matchedByName && matchedById.id !== matchedByName.id) {
		throw new BadRequestException(
			`Volume reference '${idOrName}' matches one volume's ID and another volume's name; rename the volume to remove the ambiguity`
		);
	}
	const matched = matchedById ?? matchedByName;
	if (!matched) {
		throw new NotFoundException(`Volume '${idOrName}' not found`);
	}
	if (matched.state !== VolumeState.READY) {
		throw new BadRequestException(
			`Volume '${matched.name}' is not in a ready state. Current state: ${matched.state}`
		);
	}
	return matched;
}

@Injectable()
export class VolumeService {
	constructor(private readonly entityManager: EntityManager) {}

	async findOne(volumeId: string): Promise<Volume> {
		const volume = await this.entityManager.findOne(Volume, { id: volumeId });

		if (!volume) {
			throw new NotFoundException(`Volume with ID ${volumeId} not found`);
		}

		return volume;
	}

	async findAll(
		organizationId: string,
		includeDeleted: boolean,
		limit: number,
		cursor?: string
	): Promise<CursorPage<Volume>> {
		return findCursorPage(this.entityManager, Volume, {
			where: {
				organizationId,
				...(includeDeleted ? {} : { state: { $ne: VolumeState.DELETED } }),
			},
			orderBy: {
				lastUsedAt: QueryOrder.DESC_NULLS_LAST,
				createdAt: 'DESC',
				id: 'DESC',
			},
			limit,
			cursor,
		});
	}

	async findByName(organizationId: string, name: string): Promise<Volume> {
		const volume = await this.entityManager.findOne(Volume, {
			organizationId,
			name,
			state: { $ne: VolumeState.DELETED },
		});

		if (!volume) {
			throw new NotFoundException(`Volume with name ${name} not found`);
		}

		return volume;
	}

	async getVolumesByIdOrName(
		organizationId: string,
		volumeIdOrNames: string[]
	): Promise<Map<string, Volume>> {
		if (!volumeIdOrNames.length) {
			return new Map();
		}

		const uuidRefs = volumeIdOrNames
			.filter((idOrName) => isValidUuid(idOrName))
			.map((idOrName) => idOrName.toLowerCase());
		const where: FilterQuery<Volume>[] = [
			{
				name: { $in: volumeIdOrNames },
				organizationId,
				state: { $ne: VolumeState.DELETED },
			},
		];
		if (uuidRefs.length > 0) {
			where.push({
				id: { $in: uuidRefs },
				organizationId,
				state: { $ne: VolumeState.DELETED },
			});
		}

		const foundVolumes = await this.entityManager.find(Volume, { $or: where });

		const volumesById = new Map<string, Volume>();
		const volumesByName = new Map<string, Volume>();
		for (const foundVolume of foundVolumes) {
			volumesById.set(foundVolume.id, foundVolume);
			volumesByName.set(foundVolume.name, foundVolume);
		}

		return new Map(
			volumeIdOrNames.map((idOrName) => [
				idOrName,
				resolveVolumeReference(idOrName, volumesById, volumesByName),
			])
		);
	}

	async getOrganizationId(
		params: { id: string } | { name: string; organizationId: string }
	): Promise<string> {
		if ('id' in params) {
			const volume = await this.entityManager.findOneOrFail(
				Volume,
				{ id: params.id },
				{ fields: ['organizationId'] }
			);
			if (!volume.organizationId) {
				throw new Error(`Volume ${params.id} has no owner`);
			}
			return volume.organizationId;
		}

		const volume = await this.entityManager.findOneOrFail(
			Volume,
			{
				name: params.name,
				organizationId: params.organizationId,
				state: { $ne: VolumeState.DELETED },
			},
			{ fields: ['organizationId'] }
		);

		if (!volume.organizationId) {
			throw new Error(`Volume ${params.name} has no owner`);
		}
		return volume.organizationId;
	}
}
