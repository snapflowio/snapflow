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
import { BillingLedgerService } from '../../billing/services/billing-ledger.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { EscrowEvent } from '../entities/escrow-event.entity';
import {
	escrowEventPostable,
	escrowEventPosting,
} from '../utils/escrow-event-posting.util';

function chainOrder(left: EscrowEvent, right: EscrowEvent): number {
	return left.blockNumber - right.blockNumber || left.logIndex - right.logIndex;
}

@Injectable()
export class EscrowLedgerService {
	constructor(private readonly ledger: BillingLedgerService) {}

	// Posts, in chain order, the events that move funds, are not posted yet and
	// now have the organizations their posting needs. The ledger is idempotent
	// per event, so a retried transaction cannot post twice.
	async postAttributed(
		manager: EntityManager,
		events: readonly EscrowEvent[]
	): Promise<void> {
		const ready = events
			.filter(
				(event) => event.processedAt === null && escrowEventPostable(event)
			)
			.sort(chainOrder);
		if (ready.length === 0) return;
		const processedAt = await databaseNow(manager);
		for (const event of ready) {
			const posting = escrowEventPosting(event);
			if (posting) await this.ledger.post(manager, posting);
			event.processedAt = processedAt;
		}
	}
}
