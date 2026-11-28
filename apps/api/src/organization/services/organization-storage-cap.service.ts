/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { storedBytes } from '../../billing/queries/stored-bytes.query';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { BYTES_PER_GIBIBYTE } from '../../marketplace/constants/pricing.constants';
import { NOTICE_COOLDOWN_SECONDS } from '../../notification/constants/notice.constants';
import {
	cooldownNoticeKey,
	enqueueLimitsNotice,
} from '../../notification/utils/notice-outbox.util';
import { SettingsService } from '../../settings/services/settings.service';
import { StorageErrorCode } from '../constants/organization-limits.constants';
import { LimitsNoticeKind } from '../constants/organization-quota-tier.constants';
import { OrganizationLimits } from '../entities/organization-limits.entity';
import { LimitsNoticeEvent } from '../events/limits-notice.event';
import { storageCapGib } from '../utils/storage-cap.util';
import { OrganizationLimitsService } from './organization-limits.service';

const gibibytes = (gib: number): bigint => BigInt(gib) * BYTES_PER_GIBIBYTE;
const STORAGE_CAP_NOTICE_KEY = 'storage-cap';

@Injectable()
export class OrganizationStorageCapService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly limits: OrganizationLimitsService,
		private readonly settings: SettingsService
	) {}

	async assertAvailable(organizationId: string): Promise<void> {
		const [[stored], limits, settings] = await Promise.all([
			storedBytes(this.entityManager.fork(), organizationId),
			this.limits.get(organizationId),
			this.settings.get(),
		]);
		const capGib = storageCapGib(limits, settings);
		if ((stored?.storedBytes ?? 0n) < gibibytes(capGib)) return;
		throw new ConflictException({
			code: StorageErrorCode.STORAGE_CAP_REACHED,
			message: `The organization keeps its Snapflow storage cap of ${capGib} GiB; delete snapshots, templates, volume backups or archived sandboxes to store more`,
		});
	}

	async organizationsAtCap(): Promise<string[]> {
		const manager = this.entityManager.fork();
		const stored = await storedBytes(manager);
		if (stored.length === 0) return [];
		const [limits, settings] = await Promise.all([
			manager.find(
				OrganizationLimits,
				{ organizationId: { $in: stored.map((row) => row.organizationId) } },
				{ fields: ['organizationId', 'storageCapGib'] }
			),
			this.settings.get(),
		]);
		const ownCaps = new Map(
			limits.map((row) => [row.organizationId, row.storageCapGib])
		);
		const atCap = stored.flatMap(({ organizationId, storedBytes: bytes }) => {
			const capGib = storageCapGib(
				{ storageCapGib: ownCaps.get(organizationId) ?? null },
				settings
			);
			return bytes >= gibibytes(capGib)
				? [{ organizationId, capGib, bytes }]
				: [];
		});
		await this.noticeAtCap(manager, atCap);
		return atCap.map(({ organizationId }) => organizationId);
	}

	private async noticeAtCap(
		manager: EntityManager,
		organizations: readonly {
			organizationId: string;
			capGib: number;
			bytes: bigint;
		}[]
	): Promise<void> {
		if (organizations.length === 0) return;
		const now = await databaseNow(manager);
		for (const { organizationId, capGib, bytes } of organizations) {
			await enqueueLimitsNotice(
				manager,
				new LimitsNoticeEvent(
					organizationId,
					cooldownNoticeKey(
						now,
						NOTICE_COOLDOWN_SECONDS.storageCap,
						STORAGE_CAP_NOTICE_KEY,
						organizationId
					),
					{
						kind: LimitsNoticeKind.STORAGE_CAP_REACHED,
						capGib,
						storedGib: Number(bytes / BYTES_PER_GIBIBYTE),
					},
					now
				)
			);
		}
	}
}
