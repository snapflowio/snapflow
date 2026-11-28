/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PublicClient } from 'viem';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import {
	CHAIN_CLOCK_REFRESH_MILLISECONDS,
	SETTLEMENT_PUBLIC_CLIENT,
} from '../../constants/settlement.constants';
import { maxBigInt } from '../../utils/escrow/escrow-amount.util';

interface ChainClockReading {
	reachedSeconds: bigint;
	offsetMilliseconds: number;
	refreshAt: number;
}

@Injectable()
export class ChainClockService {
	private readonly logger = new Logger(ChainClockService.name);
	private reading: ChainClockReading | null = null;
	private refreshing: Promise<ChainClockReading> | null = null;

	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient
	) {}

	async now(): Promise<Date> {
		const { offsetMilliseconds } = await this.current();
		return new Date(Date.now() + offsetMilliseconds);
	}

	async reachedSeconds(): Promise<bigint> {
		return (await this.current()).reachedSeconds;
	}

	private current(): Promise<ChainClockReading> {
		if (this.reading && Date.now() < this.reading.refreshAt) {
			return Promise.resolve(this.reading);
		}
		this.refreshing ??= this.refresh().finally(() => {
			this.refreshing = null;
		});
		return this.refreshing;
	}

	private async refresh(): Promise<ChainClockReading> {
		try {
			const block = await this.client.getBlock({ blockTag: 'latest' });
			const observedAt = Date.now();
			const reachedSeconds = maxBigInt(
				block.timestamp,
				this.reading?.reachedSeconds ?? block.timestamp
			);
			this.reading = {
				reachedSeconds,
				offsetMilliseconds:
					Number(reachedSeconds) * MILLISECONDS_PER_SECOND - observedAt,
				refreshAt: observedAt + CHAIN_CLOCK_REFRESH_MILLISECONDS,
			};
			return this.reading;
		} catch (error) {
			if (!this.reading) throw error;
			this.logger.warn(
				`Could not read the settlement chain's clock; keeping its last reading: ${errorMessage(error)}`
			);
			this.reading = {
				...this.reading,
				refreshAt: Date.now() + CHAIN_CLOCK_REFRESH_MILLISECONDS,
			};
			return this.reading;
		}
	}
}
