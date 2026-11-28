/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import type { PlacementPrice } from '../entities/placement-price.entity';
import { PlacementKind } from '../enums/placement-kind.enum';
import type { LinePrice } from '../types/pricing.types';

interface SandboxPriceAmounts {
	hourly: LinePrice;
	stopped: LinePrice;
	diskGibMonthMicroUsd: bigint;
	increasedHourlyGross: MicroUsd | null;
}

@ApiSchema({ name: 'SandboxPrice' })
export class SandboxPriceDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty() sandboxId: string;
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty({
		type: String,
		format: 'uuid',
		nullable: true,
		description:
			'Null when the sandbox runs free on a machine of its organization',
	})
	priceCardId: string | null;
	@ApiProperty({ enum: PlacementKind, enumName: 'PlacementKind' })
	placementKind: PlacementKind;
	@ApiProperty() markupBasisPoints: number;
	@ApiProperty({ type: String, nullable: true })
	maxHourlyPriceMicroUsd: string | null;
	@ApiProperty() cpu: number;
	@ApiProperty() memoryGiB: number;
	@ApiProperty() diskGiB: number;
	@ApiProperty() gpu: number;
	@ApiProperty({
		description: 'The sandbox rents its whole machine at the machine price',
	})
	wholeMachine: boolean;
	@ApiProperty({
		description: 'All-in hourly price while running, disk included, micro-USD',
	})
	hourlyPriceMicroUsd: string;
	@ApiProperty() hostHourlyMicroUsd: string;
	@ApiProperty() markupHourlyMicroUsd: string;
	@ApiProperty({
		description: 'All-in hourly price while stopped (disk only), micro-USD',
	})
	stoppedHourlyPriceMicroUsd: string;
	@ApiProperty({
		description:
			"Host disk rate while the sandbox's disk is kept on the machine, running or stopped, micro-USD per GiB-month",
	})
	diskGibMonthMicroUsd: string;
	@ApiProperty({ type: String, format: 'date-time' }) startedAt: Date;
	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			"When the machine's higher price reaches the running sandbox, unless it starts again sooner",
	})
	priceIncreaseAt: Date | null;
	@ApiProperty({
		type: String,
		nullable: true,
		description:
			'All-in hourly price while running, disk included, micro-USD, that the sandbox moves to at priceIncreaseAt; null without a scheduled increase',
	})
	increasedHourlyPriceMicroUsd: string | null;

	static from(
		placementPrice: PlacementPrice,
		prices: SandboxPriceAmounts
	): SandboxPriceDto {
		return {
			id: placementPrice.id,
			sandboxId: placementPrice.sandboxId,
			machineId: placementPrice.machineId,
			priceCardId: placementPrice.priceCardId,
			placementKind: placementPrice.placementKind,
			markupBasisPoints: placementPrice.markupBasisPoints,
			maxHourlyPriceMicroUsd: placementPrice.maxHourlyPriceMicroUsd,
			cpu: placementPrice.cpu,
			memoryGiB: placementPrice.memoryGib,
			diskGiB: placementPrice.diskGib,
			gpu: placementPrice.gpu,
			wholeMachine: placementPrice.wholeMachine,
			hourlyPriceMicroUsd: prices.hourly.grossMicroUsd.toString(),
			hostHourlyMicroUsd: prices.hourly.hostMicroUsd.toString(),
			markupHourlyMicroUsd: prices.hourly.markupMicroUsd.toString(),
			stoppedHourlyPriceMicroUsd: prices.stopped.grossMicroUsd.toString(),
			diskGibMonthMicroUsd: prices.diskGibMonthMicroUsd.toString(),
			startedAt: placementPrice.startedAt,
			priceIncreaseAt: placementPrice.priceIncreaseAt,
			increasedHourlyPriceMicroUsd:
				prices.increasedHourlyGross?.toString() ?? null,
		};
	}
}
