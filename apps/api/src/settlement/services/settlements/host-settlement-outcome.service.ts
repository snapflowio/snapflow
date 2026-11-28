/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Machine } from '../../../machine/entities/machine.entity';
import { HostNoticeKind } from '../../../notification/constants/notice.constants';
import { HostNoticeEvent } from '../../../notification/events/host-notice.event';
import {
	enqueueHostNotice,
	noticeKey,
} from '../../../notification/utils/notice-outbox.util';
import { HOST_SETTLEMENT_FAILURE } from '../../constants/host-settlement.constants';
import { SETTLEMENT_WAKE_TOPIC } from '../../constants/payment-channel.constants';
import { HostSettlement } from '../../entities/host-settlement.entity';
import type { SettlementTransaction } from '../../entities/settlement-transaction.entity';
import { HostSettlementStatus } from '../../enums/host-settlement-status.enum';
import { SettlementTransactionStatus } from '../../enums/settlement-transaction-status.enum';

@Injectable()
export class HostSettlementOutcomeService {
	constructor(private readonly wakes: ControlWakeService) {}

	async settle(
		manager: EntityManager,
		transaction: SettlementTransaction
	): Promise<void> {
		if (!transaction.hostSettlementId) return;
		const settlement = await manager.findOneOrFail(HostSettlement, {
			id: transaction.hostSettlementId,
		});
		switch (transaction.status) {
			case SettlementTransactionStatus.SUCCEEDED:
				return this.conclude(manager, settlement, {
					status: HostSettlementStatus.SUCCEEDED,
					error: null,
				});
			case SettlementTransactionStatus.DROPPED:
				manager.assign(settlement, {
					status: HostSettlementStatus.QUEUED,
					transactionHash: null,
					error: HOST_SETTLEMENT_FAILURE.DROPPED,
				});
				return;
			default:
				return this.conclude(manager, settlement, {
					status: HostSettlementStatus.FAILED,
					error: transaction.status,
				});
		}
	}

	async fail(
		manager: EntityManager,
		hostSettlementId: string,
		reason: string
	): Promise<void> {
		const settlement = await manager.findOneOrFail(HostSettlement, {
			id: hostSettlementId,
		});
		await this.conclude(manager, settlement, {
			status: HostSettlementStatus.FAILED,
			error: reason,
		});
	}

	private async conclude(
		manager: EntityManager,
		settlement: HostSettlement,
		outcome: Pick<HostSettlement, 'status' | 'error'>
	): Promise<void> {
		const settledAt = await databaseNow(manager);
		manager.assign(settlement, { ...outcome, settledAt });
		this.wakes.notifyAfterCommit(manager, SETTLEMENT_WAKE_TOPIC, [
			settlement.machineId,
		]);
		if (outcome.status === HostSettlementStatus.SUCCEEDED) {
			await this.notifyPayoutSent(manager, settlement, settledAt);
		}
	}

	private async notifyPayoutSent(
		manager: EntityManager,
		settlement: HostSettlement,
		settledAt: Date
	): Promise<void> {
		const { organizationId } = await manager.findOneOrFail(
			Machine,
			{ id: settlement.machineId },
			{ fields: ['organizationId'] }
		);
		const kind = HostNoticeKind.PAYOUT_SENT;
		await enqueueHostNotice(
			manager,
			new HostNoticeEvent(
				organizationId,
				noticeKey(kind, settlement.id),
				{
					kind,
					payoutAddress: settlement.payoutAddress,
					transactionHash: settlement.transactionHash,
				},
				settledAt
			)
		);
	}
}
