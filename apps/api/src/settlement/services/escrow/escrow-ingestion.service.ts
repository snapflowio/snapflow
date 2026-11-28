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
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { EscrowEvent } from '../../entities/escrow-event.entity';
import { SettlementChainCursor } from '../../entities/settlement-chain-cursor.entity';
import { fundingWalletOwners } from '../../queries/funding-wallet-owners.query';
import { hostKeyOwners } from '../../queries/host-keys.query';
import type {
	EscrowIdentity,
	EscrowLog,
	ProjectedEscrowEvent,
} from '../../types/escrow.types';
import type { BlockRange } from '../../utils/escrow/block-range.util';
import { escrowEventRecord } from '../../utils/escrow/escrow-event-record.util';
import { lockEscrow } from '../../utils/escrow/escrow-lock.util';
import { EscrowLedgerService } from './escrow-ledger.service';
import { EscrowProjectionService } from './escrow-projection.service';

type IngestedEscrowRecord = ReturnType<typeof escrowEventRecord> &
	ProjectedEscrowEvent &
	Pick<EscrowEvent, 'blockTimestamp'>;

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

	async ingest(
		manager: EntityManager,
		escrow: EscrowIdentity,
		range: BlockRange,
		logs: readonly EscrowLog[],
		blockTimestamps: ReadonlyMap<bigint, Date>,
		finalizedBlock: number
	): Promise<void> {
		await lockEscrow(manager, escrow);
		await this.advanceCursor(manager, escrow, range);
		const known = await this.storedLogKeys(manager, escrow, logs);
		const records: IngestedEscrowRecord[] = [];
		for (const log of logs) {
			if (known.has(logKey(log))) continue;
			const blockTimestamp = blockTimestamps.get(log.blockNumber);
			if (blockTimestamp === undefined) {
				throw new Error(`Block ${log.blockNumber} has no timestamp`);
			}
			const projection = await this.projections.apply(
				manager,
				escrow,
				log,
				blockTimestamp
			);
			records.push({
				...escrowEventRecord(log),
				...projection,
				blockTimestamp,
			});
		}
		const customers = await fundingWalletOwners(
			manager,
			records.flatMap(({ customerAddress }) =>
				customerAddress ? [customerAddress] : []
			)
		);
		const hosts = await hostKeyOwners(
			manager,
			records.flatMap(({ hostAddress }) => (hostAddress ? [hostAddress] : []))
		);
		const indexedAt = await databaseNow(manager);
		const events = records.map((record) =>
			manager.create(EscrowEvent, {
				...escrow,
				...record,
				customerOrganizationId: record.customerAddress
					? (customers.get(record.customerAddress) ?? null)
					: null,
				hostOrganizationId: record.hostAddress
					? (hosts.get(record.hostAddress) ?? null)
					: null,
				processedAt: record.movements.length > 0 ? null : indexedAt,
			})
		);
		await this.ledger.postAttributed(manager, events, finalizedBlock);
		await this.ledger.postFinalDeposits(manager, escrow, finalizedBlock);
	}

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
