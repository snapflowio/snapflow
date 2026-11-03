/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { EgressCeilingSource } from '../enums/egress-ceiling-source.enum';
import { PriceFloorSource } from '../enums/price-floor-source.enum';

@ApiSchema({ name: 'ResourceShape' })
export class ResourceShapeDto {
	@ApiProperty() cpu: number;
	@ApiProperty() memoryGiB: number;
	@ApiProperty() diskGiB: number;
	@ApiProperty() gpu: number;
}

@ApiSchema({ name: 'PriceFloor' })
export class PriceFloorDto {
	@ApiProperty() priceClass: string;
	@ApiProperty({ type: ResourceShapeDto }) referenceShape: ResourceShapeDto;
	@ApiProperty() medianMicroUsd: string;
	@ApiProperty() floorMicroUsd: string;
	@ApiProperty() sampleCount: number;
	@ApiProperty({ enum: PriceFloorSource, enumName: 'PriceFloorSource' })
	source: PriceFloorSource;
	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Reference price of the current price card',
	})
	currentReferencePriceMicroUsd: string | null;
	@ApiProperty() belowFloor: boolean;
	@ApiProperty({
		description:
			'Highest net egress price a new card may set, micro-USD per GiB',
	})
	egressCeilingMicroUsdPerGiB: string;
	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Median net egress price of Verified hosts, micro-USD per GiB',
	})
	egressMedianMicroUsdPerGiB: string | null;
	@ApiProperty() egressSampleCount: number;
	@ApiProperty({ enum: EgressCeilingSource, enumName: 'EgressCeilingSource' })
	egressCeilingSource: EgressCeilingSource;
	@ApiProperty() aboveEgressCeiling: boolean;
}
