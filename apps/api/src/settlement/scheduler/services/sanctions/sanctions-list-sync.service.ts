/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { addSeconds } from '../../../../common/utils/time.util';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import {
	SANCTIONS_LIST_SYNC,
	SANCTIONS_LIST_SYNC_ID,
} from '../../../constants/sanctions.constants';
import { SettlementAlertKind } from '../../../constants/settlement-alert.constants';
import { SanctionsListSync } from '../../../entities/sanctions-list-sync.entity';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import { sanctionsListStaleMessage } from '../../../utils/sanctions/sanctions-alert.util';
import { downloadSdnList } from '../../../utils/sanctions/sdn-list-download.util';
import { SanctionsAlertDeliveryService } from './sanctions-alert-delivery.service';
import { SanctionsListStoreService } from './sanctions-list-store.service';

interface SyncState {
	readonly sync: SanctionsListSync | null;
	readonly now: Date;
}

function syncOlderThan({ sync, now }: SyncState, ageSeconds: number): boolean {
	return !sync || sync.syncedAt <= addSeconds(now, -ageSeconds);
}

@Injectable()
export class SanctionsListSyncService {
	private readonly logger = new Logger(SanctionsListSyncService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly store: SanctionsListStoreService,
		private readonly deliveries: SanctionsAlertDeliveryService,
		private readonly locks: RedisLockProvider,
		private readonly alerts: SettlementAlertService
	) {}

	async tick(): Promise<void> {
		await this.locks.runExclusive(
			SANCTIONS_LIST_SYNC.LOCK_KEY,
			SANCTIONS_LIST_SYNC.LOCK_SECONDS,
			() => this.syncDueAndDeliver()
		);
	}

	private async syncDueAndDeliver(): Promise<void> {
		try {
			if (await this.due()) await this.syncOrAlert();
		} finally {
			await this.deliveries.deliverPending();
		}
	}

	private async syncOrAlert(): Promise<void> {
		try {
			await this.sync();
		} catch (error) {
			await this.alertIfStale(error).catch((alertError: unknown) => {
				this.logger.warn(
					`Could not check how stale the sanctions list is: ${errorMessage(alertError)}`
				);
			});
			throw error;
		}
	}

	private async sync(): Promise<void> {
		const publication = await downloadSdnList(
			this.config.get('settlement.sanctionsListUrl')
		);
		const changes = await this.store.store(publication);
		this.logger.log(
			`Synced the OFAC SDN list published ${publication.publishedAt.toISOString()}: ${publication.addresses.length} EVM addresses, ${changes.added} added, ${changes.removed.length} removed, ${changes.blocked.length} wallets newly blocked, ${changes.delisted.length} blocked wallets delisted`
		);
	}

	private async alertIfStale(error: unknown): Promise<void> {
		const state = await this.syncState();
		if (!syncOlderThan(state, SANCTIONS_LIST_SYNC.STALE_SECONDS)) return;
		await this.alerts.raise(
			SettlementAlertKind.SANCTIONS_LIST_STALE,
			sanctionsListStaleMessage(state.sync, error)
		);
	}

	private async syncState(): Promise<SyncState> {
		const manager = this.entityManager.fork();
		const sync = await manager.findOne(SanctionsListSync, {
			id: SANCTIONS_LIST_SYNC_ID,
		});
		return { sync, now: await databaseNow(manager) };
	}

	private async due(): Promise<boolean> {
		return syncOlderThan(
			await this.syncState(),
			SANCTIONS_LIST_SYNC.INTERVAL_SECONDS
		);
	}
}
