/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ESCROW_LOG_RANGE } from '../../constants/escrow.constants';
import type { BlockRange } from '../../utils/escrow/block-range.util';
import { minBigInt } from '../../utils/escrow/escrow-amount.util';
import {
	blockCount,
	narrowedLogRange,
} from '../../utils/escrow/log-range-error.util';

type ProviderLimit = Readonly<{ blocks: bigint; expiresAt: number }>;

@Injectable()
export class EscrowLogReaderService {
	private readonly logger = new Logger(EscrowLogReaderService.name);
	private providerLimit: ProviderLimit | null = null;
	private successes = 0;
	private blocks: bigint;

	constructor(private readonly config: TypedConfigService) {
		this.blocks = this.maximumBlocks;
	}

	get maximumBlocks(): bigint {
		return BigInt(this.config.get('settlement.logBlockRange'));
	}

	async read<Log>(
		window: BlockRange,
		fetch: (range: BlockRange) => Promise<readonly Log[]>
	): Promise<Log[]> {
		const logs: Log[] = [];
		let fromBlock = window.fromBlock;
		while (fromBlock <= window.toBlock) {
			const range = {
				fromBlock,
				toBlock: minBigInt(
					window.toBlock,
					fromBlock + this.currentBlocks() - 1n
				),
			};
			let page: readonly Log[];
			try {
				page = await fetch(range);
			} catch (error) {
				this.narrow(error, range);
				continue;
			}
			logs.push(...page);
			this.recordSuccess();
			fromBlock = range.toBlock + 1n;
		}
		return logs;
	}

	private currentBlocks(): bigint {
		if (this.providerLimit && this.providerLimit.expiresAt <= Date.now()) {
			this.providerLimit = null;
		}
		return this.providerLimit
			? minBigInt(this.blocks, this.providerLimit.blocks)
			: this.blocks;
	}

	private narrow(error: unknown, range: BlockRange): void {
		const narrowing = narrowedLogRange(error, range);
		if (!narrowing) throw error;
		this.blocks = narrowing.blocks;
		this.successes = 0;
		if (narrowing.providerLimit) {
			this.providerLimit = {
				blocks: narrowing.blocks,
				expiresAt: Date.now() + ESCROW_LOG_RANGE.providerLimitMilliseconds,
			};
		}
		this.logger.warn(
			`The settlement RPC rejected eth_getLogs over ${blockCount(range)} blocks; retrying ${narrowing.blocks} blocks at a time${narrowing.providerLimit ? ' as the provider suggested' : ''}`
		);
	}

	private recordSuccess(): void {
		this.successes += 1;
		if (
			this.successes < ESCROW_LOG_RANGE.successesBeforeGrowth ||
			this.blocks >= this.maximumBlocks
		) {
			return;
		}
		this.successes = 0;
		this.blocks = minBigInt(
			this.maximumBlocks,
			this.blocks * ESCROW_LOG_RANGE.growthFactor
		);
	}
}
