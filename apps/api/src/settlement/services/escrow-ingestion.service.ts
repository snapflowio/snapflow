/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { SettlementChainCursor } from '../entities/settlement-chain-cursor.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { walletOwners } from '../queries/wallet-owners.query';
import type { EscrowIdentity, EscrowLog } from '../types/escrow.types';
import type { BlockRange } from '../utils/block-range.util';
import { movesLedgerFunds } from '../utils/escrow-event-posting.util';
import { escrowEventRecord } from '../utils/escrow-event-record.util';
import { lockEscrow } from '../utils/escrow-lock.util';
import { EscrowLedgerService } from './escrow-ledger.service';
import { EscrowProjectionService } from './escrow-projection.service';

function logKey(
	log: Pick<EscrowEvent, 'transactionHash' | 'logIndex'>
): string {
	return `${log.transactionHash}:${log.logIndex}`;
}

@Injectable()
export class EscrowIngestionService {
	constructor(
		private readonly config: TypedConfigService,
		private readonly projections: EscrowProjectionService,
		private readonly ledger: EscrowLedgerService
	) {}

	// Stores one confirmed block range: its events, their projections and
	// postings, and the cursor move past it all commit together, so a crash
	// leaves the range either fully indexed or untouched.
	async ingest(
		manager: EntityManager,
		escrow: EscrowIdentity,
		range: BlockRange,
		logs: readonly EscrowLog[],
		blockTimestamps: ReadonlyMap<bigint, Date>
	): Promise<void> {
		await lockEscrow(manager, escrow);
		await this.advanceCursor(manager, escrow, range);
		const known = await this.storedLogKeys(manager, escrow, logs);
		const records = logs
			.filter((log) => !known.has(logKey(log)))
			.map((log) => ({ log, record: escrowEventRecord(log) }));
		const owners = await walletOwners(
			manager,
			records.flatMap(({ record }) =>
				[record.customerAddress, record.hostAddress].filter(
					(address) => address !== null
				)
			)
		);
		const indexedAt = await databaseNow(manager);
		const events: EscrowEvent[] = [];
		for (const { log, record } of records) {
			const blockTimestamp = blockTimestamps.get(log.blockNumber);
			if (blockTimestamp === undefined) {
				throw new Error(`Block ${log.blockNumber} has no timestamp`);
			}
			events.push(
				manager.create(EscrowEvent, {
					...escrow,
					...record,
					blockTimestamp,
					customerOrganizationId: record.customerAddress
						? (owners[PaymentWalletPurpose.FUNDING].get(
								record.customerAddress
							) ?? null)
						: null,
					hostOrganizationId: record.hostAddress
						? (owners[PaymentWalletPurpose.PAYOUT].get(record.hostAddress) ??
							null)
						: null,
					processedAt: movesLedgerFunds(record.kind) ? null : indexedAt,
				})
			);
			await this.projections.apply(manager, escrow, log, blockTimestamp);
		}
		await this.ledger.postAttributed(manager, events);
	}

	// Refuses a range that does not start right after the stored cursor, which
	// would skip or repeat blocks.
	private async advanceCursor(
		manager: EntityManager,
		escrow: EscrowIdentity,
		range: BlockRange
	): Promise<void> {
		const cursor = await manager.findOne(SettlementChainCursor, escrow, {
			lockMode: LockMode.PESSIMISTIC_WRITE,
		});
		const expectedFrom = cursor
			? BigInt(cursor.lastIndexedBlock) + 1n
			: BigInt(this.config.get('settlement.escrowDeploymentBlock'));
		if (range.fromBlock !== expectedFrom) {
			throw new Error(
				`Escrow cursor expects block ${expectedFrom}, not ${range.fromBlock}`
			);
		}
		const lastIndexedBlock = Number(range.toBlock);
		if (cursor) {
			cursor.lastIndexedBlock = lastIndexedBlock;
			return;
		}
		manager.create(SettlementChainCursor, { ...escrow, lastIndexedBlock });
	}

	private async storedLogKeys(
		manager: EntityManager,
		escrow: EscrowIdentity,
		logs: readonly EscrowLog[]
	): Promise<Set<string>> {
		if (logs.length === 0) return new Set();
		const stored = await manager.find(
			EscrowEvent,
			{
				chainId: escrow.chainId,
				transactionHash: {
					$in: [...new Set(logs.map((log) => log.transactionHash))],
				},
			},
			{ fields: ['transactionHash', 'logIndex'] }
		);
		return new Set(stored.map(logKey));
	}
}
