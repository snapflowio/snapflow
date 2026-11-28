/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { priceClassRatePercentiles } from '../queries/price-class-market.query';

type RatePercentileRow = NonNullable<
	Awaited<ReturnType<typeof priceClassRatePercentiles>>
>;

@ApiSchema({ name: 'RatePercentiles' })
export class RatePercentilesDto {
	@ApiProperty({ description: '10th percentile ask, micro-USD' })
	low: string;
	@ApiProperty({ description: 'Median ask, micro-USD' })
	median: string;
	@ApiProperty({ description: '90th percentile ask, micro-USD' })
	high: string;

	static from(values: string[] | null): RatePercentilesDto | null {
		const [low, median, high] = values ?? [];
		return low && median && high ? { low, median, high } : null;
	}
}

@ApiSchema({ name: 'MachineMarketRates' })
export class MachineMarketRatesDto {
	@ApiProperty({ type: RatePercentilesDto, nullable: true })
	vcpuHourMicroUsd: RatePercentilesDto | null;
	@ApiProperty({ type: RatePercentilesDto, nullable: true })
	memoryGibHourMicroUsd: RatePercentilesDto | null;
	@ApiProperty({ type: RatePercentilesDto, nullable: true })
	gpuHourMicroUsd: RatePercentilesDto | null;
	@ApiProperty({ type: RatePercentilesDto, nullable: true })
	diskGibMonthMicroUsd: RatePercentilesDto | null;
}

@ApiSchema({ name: 'MachineMarket' })
export class MachineMarketDto {
	@ApiProperty({ description: 'Price class the machine is compared within' })
	priceClass: string;
	@ApiProperty({
		description:
			'Public listings in the class with a price, not counting this machine',
	})
	comparableListings: number;
	@ApiProperty({
		description: "Share of the class's capacity rented right now, basis points",
	})
	fillBasisPoints: number;
	@ApiProperty({
		description:
			"Snapflow's markup on the host's rates that customers pay, basis points",
	})
	markupBasisPoints: number;
	@ApiProperty({
		type: MachineMarketRatesDto,
		description:
			"What comparable listings ask for each rate; facts, not Snapflow's recommendation",
	})
	rates: MachineMarketRatesDto;

	static ratesFrom(row: RatePercentileRow | null): MachineMarketRatesDto {
		return {
			vcpuHourMicroUsd: RatePercentilesDto.from(row?.vcpuHourMicroUsd ?? null),
			memoryGibHourMicroUsd: RatePercentilesDto.from(
				row?.memoryGibHourMicroUsd ?? null
			),
			gpuHourMicroUsd: RatePercentilesDto.from(row?.gpuHourMicroUsd ?? null),
			diskGibMonthMicroUsd: RatePercentilesDto.from(
				row?.diskGibMonthMicroUsd ?? null
			),
		};
	}
}
