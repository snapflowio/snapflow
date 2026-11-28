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
import { BillingLedgerService } from '../../../billing/services/ledger/billing-ledger.service';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	enqueueQuotaTierEvaluation,
	noticeKey,
} from '../../../notification/utils/notice-outbox.util';
import { QuotaTierEvents } from '../../../organization/constants/organization-quota-tier.constants';
import { SettingsService } from '../../../settings/services/settings.service';
import { DEPOSITED_EVENT } from '../../constants/escrow.constants';
import { EscrowEvent } from '../../entities/escrow-event.entity';
import type { EscrowIdentity } from '../../types/escrow.types';
import {
	escrowEventPostable,
	escrowEventPosting,
} from '../../utils/escrow/escrow-event-posting.util';

function chainOrder(left: EscrowEvent, right: EscrowEvent): number {
	return left.blockNumber - right.blockNumber || left.logIndex - right.logIndex;
}

@Injectable()
export class EscrowLedgerService {
	constructor(
		private readonly ledger: BillingLedgerService,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService
	) {}

	async postAttributed(
		manager: EntityManager,
		events: readonly EscrowEvent[],
		finalizedBlock: number | null
	): Promise<void> {
		const platformAddress = this.config.get('settlement.feeReceiverAddress');
		const { largeDepositThresholdCents } = await this.settings.get();
		const finality = {
			largeDepositMicroUsd: MicroUsd.fromCents(
				largeDepositThresholdCents
			).toBigInt(),
			finalizedBlock,
		};
		const ready = events
			.filter(
				(event) =>
					event.processedAt === null &&
					escrowEventPostable(event, platformAddress, finality)
			)
			.sort(chainOrder);
		if (ready.length === 0) return;
		const processedAt = await databaseNow(manager);
		for (const event of ready) {
			await this.ledger.post(
				manager,
				escrowEventPosting(event, platformAddress)
			);
			event.processedAt = processedAt;
			if (event.kind === DEPOSITED_EVENT && event.customerOrganizationId) {
				await enqueueQuotaTierEvaluation(
					manager,
					event.customerOrganizationId,
					noticeKey(
						QuotaTierEvents.EVALUATE,
						event.chainId,
						event.transactionHash,
						event.logIndex
					)
				);
			}
		}
	}

	async postFinalDeposits(
		manager: EntityManager,
		escrow: EscrowIdentity,
		finalizedBlock: number
	): Promise<void> {
		const waiting = await manager.find(EscrowEvent, {
			...escrow,
			kind: 'Deposited',
			processedAt: null,
			customerOrganizationId: { $ne: null },
			blockNumber: { $lte: finalizedBlock },
		});
		await this.postAttributed(manager, waiting, finalizedBlock);
	}
}
