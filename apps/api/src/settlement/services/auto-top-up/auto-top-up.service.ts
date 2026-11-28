/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_RELAY_FEE } from '@snapflow/contracts';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	AUTO_TOP_UP_DEFAULT_MAX_RELAY_FEE_MICRO_USD,
	AUTO_TOP_UP_TIMES_PER_DAY,
	AutoTopUpErrorCode,
} from '../../constants/auto-top-up.constants';
import {
	AutoTopUpDto,
	type AutoTopUpTerms,
	type UpdateAutoTopUpDto,
} from '../../dto/auto-top-up.dto';
import { AutoTopUp } from '../../entities/auto-top-up.entity';
import { autoTopUpState } from '../../queries/auto-top-up-state.query';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';

@Injectable()
export class AutoTopUpService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService
	) {}

	async get(organizationId: string): Promise<AutoTopUpDto> {
		const manager = this.entityManager.fork();
		const relayer = this.config.get('settlement.relayerAddress');
		const state = await autoTopUpState(
			manager,
			configuredEscrow(this.config),
			relayer,
			organizationId
		);
		return AutoTopUpDto.from(state, relayer, await this.defaults());
	}

	async update(
		organizationId: string,
		input: UpdateAutoTopUpDto
	): Promise<AutoTopUpDto> {
		const terms = await this.validTerms(input);
		await this.entityManager.fork().transactional(async (manager) => {
			await manager.upsert(
				AutoTopUp,
				{
					organizationId,
					enabled: input.enabled,
					...terms,
					updatedAt: await databaseNow(manager),
				},
				{
					onConflictFields: ['organizationId'],
					onConflictMergeFields: [
						'enabled',
						'amountMicroUsd',
						'thresholdMicroUsd',
						'maxRelayFeeMicroUsd',
						'timesPerDay',
						'updatedAt',
					],
				}
			);
		});
		return this.get(organizationId);
	}

	private async defaults(): Promise<AutoTopUpTerms> {
		const minimum = await this.minimumDeposit();
		return {
			amountMicroUsd: minimum.toString(),
			thresholdMicroUsd: minimum.toString(),
			maxRelayFeeMicroUsd:
				AUTO_TOP_UP_DEFAULT_MAX_RELAY_FEE_MICRO_USD.toString(),
			timesPerDay: AUTO_TOP_UP_TIMES_PER_DAY.default,
		};
	}

	private async validTerms(input: UpdateAutoTopUpDto): Promise<AutoTopUpTerms> {
		const minimum = await this.minimumDeposit();
		const amount = MicroUsd.parse(input.amount);
		if (amount.lessThan(minimum)) {
			throw new BadRequestException({
				code: AutoTopUpErrorCode.AMOUNT_BELOW_MINIMUM_DEPOSIT,
				message: `A top-up is at least the minimum deposit of $${minimum.toUsd()}`,
				minimumMicroUsd: minimum.toString(),
			});
		}
		const threshold = BigInt(input.threshold);
		if (threshold === 0n) {
			throw new BadRequestException({
				code: AutoTopUpErrorCode.THRESHOLD_ZERO,
				message: 'The top-up threshold is above zero',
			});
		}
		const maxRelayFee = BigInt(input.maxRelayFee);
		if (maxRelayFee > MAX_RELAY_FEE || maxRelayFee >= amount.toBigInt()) {
			throw new BadRequestException({
				code: AutoTopUpErrorCode.MAX_RELAY_FEE_INVALID,
				message: `The maximum relay fee is at most ${MAX_RELAY_FEE} micro-USD and below the top-up amount`,
			});
		}
		return {
			amountMicroUsd: amount.toString(),
			thresholdMicroUsd: threshold.toString(),
			maxRelayFeeMicroUsd: maxRelayFee.toString(),
			timesPerDay: input.timesPerDay,
		};
	}

	private async minimumDeposit(): Promise<MicroUsd> {
		const { minimumDepositCents } = await this.settings.get();
		return MicroUsd.fromCents(minimumDepositCents);
	}
}
