/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsInt, Matches, Max, Min } from 'class-validator';
import type { Address } from 'viem';
import { MICRO_USD_PATTERN } from '../../common/constants/money.constants';
import {
	AUTO_TOP_UP_TIMES_PER_DAY,
	AutoTopUpStatus,
} from '../constants/auto-top-up.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { AutoTopUp } from '../entities/auto-top-up.entity';
import type { AutoTopUpState } from '../queries/auto-top-up-state.query';
import {
	autoTopUpInSync,
	autoTopUpMinInterval,
	nextTopUpAt,
} from '../utils/auto-top-up/auto-top-up.util';

const AMOUNT_PROPERTY = {
	...UINT_STRING_API_PROPERTY,
	description:
		"setAutoTopUp's amount: what each top-up pulls from the allowance, micro-USD; the relay fee comes out of it",
} as const;

const THRESHOLD_PROPERTY = {
	...UINT_STRING_API_PROPERTY,
	description:
		"setAutoTopUp's threshold: the escrow balance (free plus pending) below which a top-up may run, micro-USD",
} as const;

const MAX_RELAY_FEE_PROPERTY = {
	...UINT_STRING_API_PROPERTY,
	description:
		"setAutoTopUp's maxRelayFee: the most one top-up may pay the relayer for its gas, micro-USD; below amount and at most the escrow's MAX_RELAY_FEE",
} as const;

const TIMES_PER_DAY_PROPERTY = {
	type: 'integer',
	minimum: AUTO_TOP_UP_TIMES_PER_DAY.minimum,
	maximum: AUTO_TOP_UP_TIMES_PER_DAY.maximum,
	description:
		"At most this many top-ups a day; setAutoTopUp's minInterval is floor(86400 / timesPerDay) seconds, at least MIN_AUTO_TOP_UP_INTERVAL",
} as const;

@ApiSchema({ name: 'AutoTopUpLimits' })
export class AutoTopUpLimitsDto {
	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The relayer the funding wallet lets pull from its allowance',
	})
	relayerAddress: Address;

	@ApiProperty(AMOUNT_PROPERTY)
	amount: string;

	@ApiProperty(THRESHOLD_PROPERTY)
	threshold: string;

	@ApiProperty(MAX_RELAY_FEE_PROPERTY)
	maxRelayFee: string;

	@ApiProperty({
		type: 'integer',
		description: 'Shortest gap between two pulls, seconds',
	})
	minInterval: number;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	lastTopUpAt: Date | null;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description: 'Earliest the next pull may run',
	})
	nextTopUpAt: Date | null;
}

@ApiSchema({ name: 'AutoTopUp' })
export class AutoTopUpDto {
	@ApiProperty() enabled: boolean;

	@ApiProperty(AMOUNT_PROPERTY)
	amount: string;

	@ApiProperty(THRESHOLD_PROPERTY)
	threshold: string;

	@ApiProperty(MAX_RELAY_FEE_PROPERTY)
	maxRelayFee: string;

	@ApiProperty(TIMES_PER_DAY_PROPERTY)
	timesPerDay: number;

	@ApiProperty({
		type: 'integer',
		description:
			"setAutoTopUp's minInterval for timesPerDay: floor(86400 / timesPerDay) seconds",
	})
	minInterval: number;

	@ApiProperty({ enum: AutoTopUpStatus, enumName: 'AutoTopUpStatus' })
	status: AutoTopUpStatus;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			"Snapflow's relayer, the address the funding wallet names in setAutoTopUp",
	})
	relayerAddress: Address;

	@ApiProperty({
		type: AutoTopUpLimitsDto,
		nullable: true,
		description:
			'The limits the funding wallet set on-chain; null until it calls setAutoTopUp',
	})
	limits: AutoTopUpLimitsDto | null;

	@ApiProperty({
		description:
			"Whether the on-chain limits name Snapflow's relayer and match these terms; when not, the funding wallet sends setAutoTopUp with them",
	})
	inSync: boolean;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	lastAttemptAt: Date | null;

	@ApiProperty({ type: String, nullable: true })
	lastTransactionHash: string | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	lastFailedAt: Date | null;

	@ApiProperty({ type: String, nullable: true })
	lastError: string | null;

	static from(
		state: AutoTopUpState,
		relayerAddress: Address,
		defaults: AutoTopUpTerms
	): AutoTopUpDto {
		const { settings, limits } = state;
		const terms: AutoTopUpTerms = settings ?? defaults;
		return {
			enabled: settings?.enabled ?? false,
			amount: terms.amountMicroUsd,
			threshold: terms.thresholdMicroUsd,
			maxRelayFee: terms.maxRelayFeeMicroUsd,
			timesPerDay: terms.timesPerDay,
			minInterval: autoTopUpMinInterval(terms.timesPerDay),
			status: state.status,
			relayerAddress,
			limits: limits && {
				relayerAddress: limits.relayerAddress,
				amount: limits.amountMicroUsd,
				threshold: limits.thresholdMicroUsd,
				maxRelayFee: limits.maxRelayFeeMicroUsd,
				minInterval: limits.minIntervalSeconds,
				lastTopUpAt: limits.lastTopUpAt,
				nextTopUpAt: nextTopUpAt(limits),
			},
			inSync: limits !== null && autoTopUpInSync(terms, limits, relayerAddress),
			lastAttemptAt: settings?.lastAttemptAt ?? null,
			lastTransactionHash: settings?.lastTransactionHash ?? null,
			lastFailedAt: settings?.lastFailedAt ?? null,
			lastError: settings?.lastError ?? null,
		};
	}
}

export type AutoTopUpTerms = Pick<
	AutoTopUp,
	'amountMicroUsd' | 'thresholdMicroUsd' | 'maxRelayFeeMicroUsd' | 'timesPerDay'
>;

@ApiSchema({ name: 'UpdateAutoTopUp' })
export class UpdateAutoTopUpDto {
	@ApiProperty()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description: `${AMOUNT_PROPERTY.description}; at least the minimum deposit`,
	})
	@Matches(MICRO_USD_PATTERN)
	amount: string;

	@ApiProperty({
		...THRESHOLD_PROPERTY,
		description: `${THRESHOLD_PROPERTY.description}; above zero`,
	})
	@Matches(MICRO_USD_PATTERN)
	threshold: string;

	@ApiProperty(MAX_RELAY_FEE_PROPERTY)
	@Matches(MICRO_USD_PATTERN)
	maxRelayFee: string;

	@ApiProperty(TIMES_PER_DAY_PROPERTY)
	@IsInt()
	@Min(AUTO_TOP_UP_TIMES_PER_DAY.minimum)
	@Max(AUTO_TOP_UP_TIMES_PER_DAY.maximum)
	timesPerDay: number;
}
