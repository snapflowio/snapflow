/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsInt,
	IsOptional,
	Matches,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import {
	MARKETPLACE_MONEY_PRECISION,
	POSITIVE_MICRO_USD_PATTERN,
} from '../constants/marketplace.constants';
import { INTERRUPTIBLE_PRICE } from '../constants/pricing.constants';
import type { MachinePriceCard } from '../entities/machine-price-card.entity';
import { machineHourMicroUsd } from '../utils/pricing/slice-pricing.util';

const RATE_DESCRIPTIONS = {
	vcpu: 'Host rate per vCPU-hour, micro-USD',
	memory: 'Host rate per GiB of memory per hour, micro-USD',
	gpu: 'Host rate per GPU-hour, micro-USD; zero on machines without GPUs',
	disk: "Host rate per GiB-month of a sandbox's disk kept on the machine, running or stopped, micro-USD",
	interruptible:
		'Share of the rates charged for interruptible sandboxes, basis points',
} as const;

const RateInput = (description: string) =>
	applyDecorators(
		ApiProperty({ type: String, description }),
		MaxLength(MARKETPLACE_MONEY_PRECISION),
		Matches(POSITIVE_MICRO_USD_PATTERN)
	);

@ApiSchema({ name: 'PriceCard' })
export class PriceCardDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty() version: number;
	@ApiProperty({ description: RATE_DESCRIPTIONS.vcpu })
	vcpuHourMicroUsd: string;
	@ApiProperty({ description: RATE_DESCRIPTIONS.memory })
	memoryGibHourMicroUsd: string;
	@ApiProperty({ description: RATE_DESCRIPTIONS.gpu })
	gpuHourMicroUsd: string;
	@ApiProperty({ description: RATE_DESCRIPTIONS.disk })
	diskGibMonthMicroUsd: string;
	@ApiProperty({
		description:
			'Host price of the whole machine for an hour at these rates, micro-USD; the host keeps all of it',
	})
	machineHourMicroUsd: string;
	@ApiProperty({ description: 'Benchmarked vCPUs the card prices' })
	vcpu: number;
	@ApiProperty({ description: 'Benchmarked GiB of memory the card prices' })
	memoryGib: number;
	@ApiProperty({ description: 'Benchmarked GPUs the card prices' })
	gpuCount: number;
	@ApiProperty({
		description: RATE_DESCRIPTIONS.interruptible,
		minimum: INTERRUPTIBLE_PRICE.MINIMUM_BASIS_POINTS,
		maximum: INTERRUPTIBLE_PRICE.MAXIMUM_BASIS_POINTS,
	})
	interruptibleBasisPoints: number;
	@ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	createdBy: string | null;

	static from(card: MachinePriceCard): PriceCardDto {
		return {
			id: card.id,
			machineId: card.machineId,
			version: card.version,
			vcpuHourMicroUsd: card.vcpuHourMicroUsd,
			memoryGibHourMicroUsd: card.memoryGibHourMicroUsd,
			gpuHourMicroUsd: card.gpuHourMicroUsd,
			diskGibMonthMicroUsd: card.diskGibMonthMicroUsd,
			machineHourMicroUsd: machineHourMicroUsd(card).toString(),
			vcpu: card.vcpu,
			memoryGib: card.memoryGib,
			gpuCount: card.gpuCount,
			interruptibleBasisPoints: card.interruptibleBasisPoints,
			createdAt: card.createdAt,
			createdBy: card.createdBy,
		};
	}
}

@ApiSchema({ name: 'PriceCardPage' })
export class PriceCardPageDto extends CursorPageDto<PriceCardDto> {
	@ApiProperty({ type: PriceCardDto, isArray: true })
	declare items: PriceCardDto[];
}

@ApiSchema({ name: 'CreatePriceCard' })
export class CreatePriceCardDto {
	@RateInput(RATE_DESCRIPTIONS.vcpu)
	vcpuHourMicroUsd: string;

	@RateInput(RATE_DESCRIPTIONS.memory)
	memoryGibHourMicroUsd: string;

	@ApiPropertyOptional({
		type: String,
		description: `${RATE_DESCRIPTIONS.gpu}; required exactly when the machine has GPUs`,
	})
	@IsOptional()
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(POSITIVE_MICRO_USD_PATTERN)
	gpuHourMicroUsd?: string;

	@RateInput(RATE_DESCRIPTIONS.disk)
	diskGibMonthMicroUsd: string;

	@ApiPropertyOptional({
		description: `${RATE_DESCRIPTIONS.interruptible}; omitted keeps the current share`,
		minimum: INTERRUPTIBLE_PRICE.MINIMUM_BASIS_POINTS,
		maximum: INTERRUPTIBLE_PRICE.MAXIMUM_BASIS_POINTS,
	})
	@IsOptional()
	@IsInt()
	@Min(INTERRUPTIBLE_PRICE.MINIMUM_BASIS_POINTS)
	@Max(INTERRUPTIBLE_PRICE.MAXIMUM_BASIS_POINTS)
	interruptibleBasisPoints?: number;
}
