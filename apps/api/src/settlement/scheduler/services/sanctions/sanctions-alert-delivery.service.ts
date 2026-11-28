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
import {
	SANCTIONS_ALERT_DELIVERY,
	SanctionsPendingAlertKind,
} from '../../../constants/sanctions.constants';
import { SanctionsPendingAlert } from '../../../entities/sanctions-pending-alert.entity';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import { SANCTIONS_PENDING_ALERT_MESSAGE } from '../../../utils/sanctions/sanctions-alert.util';

@Injectable()
export class SanctionsAlertDeliveryService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly alerts: SettlementAlertService
	) {}

	async deliverPending(): Promise<void> {
		for (const kind of Object.values(SanctionsPendingAlertKind)) {
			await this.deliverBatch(kind);
		}
	}

	private async deliverBatch(kind: SanctionsPendingAlertKind): Promise<void> {
		const manager = this.entityManager.fork();
		const pending = await manager.find(
			SanctionsPendingAlert,
			{ kind },
			{
				orderBy: { createdAt: QueryOrder.ASC, id: QueryOrder.ASC },
				limit: SANCTIONS_ALERT_DELIVERY.WALLETS_PER_ALERT,
			}
		);
		const [first] = pending;
		if (!first) return;
		const delivered = await this.alerts.deliver(
			kind,
			SANCTIONS_PENDING_ALERT_MESSAGE[kind](pending),
			first.id
		);
		if (!delivered) return;
		await manager.nativeDelete(SanctionsPendingAlert, {
			id: { $in: pending.map(({ id }) => id) },
		});
	}
}
