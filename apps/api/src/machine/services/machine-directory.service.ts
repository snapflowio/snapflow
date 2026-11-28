/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { locationWhere } from '../../location/utils/location-constraint.util';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import type { MachineListQueryDto } from '../dto/machine.dto';
import { MachineFullDto } from '../dto/machine-full.dto';
import { Machine } from '../entities/machine.entity';
import { MachineService } from './machine.service';

@Injectable()
export class MachineDirectoryService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly marketplace: MachineMarketplaceService,
		private readonly machines: MachineService
	) {}

	async findAllFull(
		limit: number,
		cursor?: string,
		location?: string
	): Promise<CursorPage<MachineFullDto>> {
		const page = await findCursorPage(this.entityManager, Machine, {
			where: locationWhere(location),
			orderBy: { createdAt: QueryOrder.DESC, id: QueryOrder.DESC },
			limit,
			cursor,
		});
		return { ...page, items: await this.toFullDtos(page.items) };
	}

	async findAllByOrganization(
		organizationId: string,
		query: MachineListQueryDto
	): Promise<CursorPage<MachineFullDto>> {
		const page = await findCursorPage(this.entityManager, Machine, {
			where: {
				organizationId,
				...locationWhere(query.location),
				...(query.enrollmentKeyId !== undefined && {
					enrollmentKeyId: query.enrollmentKeyId,
				}),
			},
			orderBy: { createdAt: QueryOrder.DESC, id: QueryOrder.DESC },
			limit: query.limit,
			cursor: query.cursor,
		});
		return { ...page, items: await this.toFullDtos(page.items) };
	}

	async findOneFullOrFail(id: string): Promise<MachineFullDto> {
		return this.toFullDto(await this.machines.findOneOrFail(id));
	}

	async toFullDto(machine: Machine): Promise<MachineFullDto> {
		const [full] = await this.toFullDtos([machine]);
		return full;
	}

	private async toFullDtos(
		machines: readonly Machine[]
	): Promise<MachineFullDto[]> {
		const statuses = await this.marketplace.statuses(machines);
		return machines.map((machine) =>
			MachineFullDto.fromMachineStatus(
				machine,
				statuses.get(machine.id) ?? null
			)
		);
	}
}
