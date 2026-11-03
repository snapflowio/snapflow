/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Matches, MaxLength } from 'class-validator';
import { MICRO_USD_PATTERN } from '../../../common/constants/money.constants';
import { CursorPageDto } from '../../../common/dto/cursor-page.dto';
import {
	MARKETPLACE_MONEY_PRECISION,
	POSITIVE_MICRO_USD_PATTERN,
} from '../constants/marketplace.constants';
import type { MachinePriceCard } from '../entities/machine-price-card.entity';

@ApiSchema({ name: 'PriceCard' })
export class PriceCardDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty() version: number;
	@ApiProperty() vcpuHourMicroUsd: string;
	@ApiProperty() memoryGibHourMicroUsd: string;
	@ApiProperty() gpuHourMicroUsd: string;
	@ApiProperty() diskGibMonthMicroUsd: string;
	@ApiProperty() stoppedDiskGibMonthMicroUsd: string;
	@ApiProperty({ description: 'Net egress price, micro-USD per GiB' })
	egressMicroUsdPerGiB: string;
	@ApiProperty({
		description: 'Egress price ceiling in force when the card was made',
	})
	egressCeilingMicroUsdPerGiB: string;
	@ApiProperty({
		description: 'Host price of the class reference shape for one hour',
	})
	referencePriceMicroUsd: string;
	@ApiProperty({ description: 'Price floor in force when the card was made' })
	floorMicroUsd: string;
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
			stoppedDiskGibMonthMicroUsd: card.stoppedDiskGibMonthMicroUsd,
			egressMicroUsdPerGiB: card.egressMicroUsdPerGiB,
			egressCeilingMicroUsdPerGiB: card.egressCeilingMicroUsdPerGiB,
			referencePriceMicroUsd: card.referencePriceMicroUsd,
			floorMicroUsd: card.floorMicroUsd,
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
	@ApiProperty({ type: String })
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(POSITIVE_MICRO_USD_PATTERN)
	vcpuHourMicroUsd: string;

	@ApiProperty({ type: String })
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(POSITIVE_MICRO_USD_PATTERN)
	memoryGibHourMicroUsd: string;

	@ApiProperty({
		type: String,
		description: 'Per GPU of the measured model; positive for GPU machines',
	})
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(MICRO_USD_PATTERN)
	gpuHourMicroUsd: string;

	@ApiProperty({ type: String })
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(POSITIVE_MICRO_USD_PATTERN)
	diskGibMonthMicroUsd: string;

	@ApiProperty({ type: String })
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(POSITIVE_MICRO_USD_PATTERN)
	stoppedDiskGibMonthMicroUsd: string;

	@ApiProperty({
		type: String,
		description: 'Net egress price, micro-USD per GiB; zero offers free egress',
	})
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(MICRO_USD_PATTERN)
	egressMicroUsdPerGiB: string;
}
