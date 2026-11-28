/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import {
	type BeforeApplicationShutdown,
	Inject,
	Injectable,
	Logger,
	type OnApplicationBootstrap,
} from '@nestjs/common';
import type { ObservableCallback } from '@opentelemetry/api';
import type { GetCodeReturnType, PublicClient } from 'viem';
import { fullJitterBackoffMilliseconds } from '../../../common/utils/concurrency/full-jitter-backoff.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import {
	METRIC_NAME,
	METRIC_UNIT,
	MILLISECONDS_PER_SECOND,
} from '../../../infra/metrics/constants/metrics.constants';
import { lazyInstrument } from '../../../infra/metrics/utils/snapflow-meter.util';
import {
	CHAIN_IDENTITY_RETRY_BACKOFF,
	SETTLEMENT_PUBLIC_CLIENT,
} from '../../constants/settlement.constants';
import { SettlementAlertKind } from '../../constants/settlement-alert.constants';
import { SettlementAlertService } from '../alerts/settlement-alert.service';

const EMPTY_BYTECODE = '0x';

const unverifiedAge = lazyInstrument((meter) =>
	meter.createObservableGauge(
		METRIC_NAME.SETTLEMENT_CHAIN_IDENTITY_UNVERIFIED_AGE,
		{
			description:
				'How long the settlement chain ID and escrow bytecode have gone unconfirmed; 0 once confirmed',
			unit: METRIC_UNIT.SECONDS,
		}
	)
);

@Injectable()
export class ChainIdentityCheckService
	implements OnApplicationBootstrap, BeforeApplicationShutdown
{
	private readonly logger = new Logger(ChainIdentityCheckService.name);
	private readonly abort = new AbortController();
	private readonly startedAt = performance.now();
	#verified = false;

	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly alerts: SettlementAlertService
	) {}

	get verified(): boolean {
		return this.#verified;
	}

	private readonly observe: ObservableCallback = (result) => {
		result.observe(
			this.#verified
				? 0
				: (performance.now() - this.startedAt) / MILLISECONDS_PER_SECOND
		);
	};

	onApplicationBootstrap(): void {
		unverifiedAge().addCallback(this.observe);
		this.verify().catch((error: unknown) => {
			this.logger.error(
				`Settlement chain identity check stopped; settlement jobs stay stopped: ${errorMessage(error)}`
			);
		});
	}

	beforeApplicationShutdown(): void {
		this.abort.abort();
		unverifiedAge().removeCallback(this.observe);
	}

	private async verify(): Promise<void> {
		for (let attempt = 0; !this.abort.signal.aborted; attempt += 1) {
			const identity = await this.readIdentity();
			if (identity && (await this.conclude(...identity))) return;
			try {
				await sleep(
					fullJitterBackoffMilliseconds(attempt, CHAIN_IDENTITY_RETRY_BACKOFF),
					undefined,
					{ signal: this.abort.signal }
				);
			} catch (error) {
				if (this.abort.signal.aborted) return;
				throw error;
			}
		}
	}

	private async readIdentity() {
		try {
			return await Promise.all([
				this.client.getChainId(),
				this.client.getCode({
					address: this.config.get('settlement.escrowAddress'),
				}),
			]);
		} catch (error) {
			this.logger.warn(
				`Could not confirm the settlement chain yet; settlement jobs wait and the check retries: ${errorMessage(error)}`
			);
			return null;
		}
	}

	private async conclude(
		chainId: number,
		bytecode: GetCodeReturnType
	): Promise<boolean> {
		const expectedChainId = this.config.get('settlement.chainId');
		if (chainId !== expectedChainId) {
			await this.alerts.raise(
				SettlementAlertKind.CHAIN_IDENTITY_MISMATCH,
				`SETTLEMENT_RPC_URL serves chain ${chainId}, but SETTLEMENT_CHAIN_ID is ${expectedChainId}. Settlement jobs stay stopped until the configuration is fixed and the service restarts.`
			);
			return true;
		}
		if (!bytecode || bytecode === EMPTY_BYTECODE) {
			this.logger.warn(
				`SETTLEMENT_ESCROW_ADDRESS ${this.config.get('settlement.escrowAddress')} has no contract code on chain ${chainId} yet; settlement jobs wait and the check retries`
			);
			return false;
		}
		this.#verified = true;
		this.logger.log(`Settlement chain ${chainId} and escrow confirmed`);
		return true;
	}
}
