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
import { apiError } from '../../common/utils/error/api-error.util';
import { isValidUuid } from '../../common/utils/uuid.util';
import { CreateSandboxDto } from '../../sandbox/dto/create-sandbox.dto';
import { SettingsService } from '../../settings/services/settings.service';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotErrorCode } from '../enums/snapshot-error-code.enum';

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
				apiError(
					SnapshotErrorCode.REQUIRED,
					'No default snapshot is configured. Set the snapshot of the sandbox and try again.'
				)
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
