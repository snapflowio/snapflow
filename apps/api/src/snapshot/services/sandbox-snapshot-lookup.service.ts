/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { isValidUuid } from '../../common/utils/uuid.util';
import { CreateSandboxDto } from '../../sandbox/dto/create-sandbox.dto';
import { SettingsService } from '../../settings/services/settings.service';
import { Snapshot } from '../entities/snapshot.entity';

@Injectable()
export class SandboxSnapshotLookupService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService
	) {}

	async requestedSnapshot(
		request: Pick<CreateSandboxDto, 'snapshot'>
	): Promise<string> {
		const snapshot =
			request.snapshot?.trim() || (await this.settings.get()).defaultSnapshot;
		if (!snapshot) {
			throw new BadRequestException(
				'Name a snapshot: the platform has no default snapshot'
			);
		}
		return snapshot;
	}

	findSnapshotCandidates(
		organizationId: string,
		snapshotIdOrName: string
	): Promise<Snapshot[]> {
		const where: FilterQuery<Snapshot>[] = [
			{ organizationId, name: snapshotIdOrName },
			{ general: true, name: snapshotIdOrName },
		];
		if (isValidUuid(snapshotIdOrName)) {
			where.push(
				{ organizationId, id: snapshotIdOrName },
				{ general: true, id: snapshotIdOrName }
			);
		}
		return this.entityManager.find(Snapshot, where);
	}
}
