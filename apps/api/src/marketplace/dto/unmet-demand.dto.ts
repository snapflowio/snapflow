/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Continent } from '../../location/enums/continent.enum';

@ApiSchema({ name: 'UnmetDemand' })
export class UnmetDemandDto {
	@ApiProperty({
		description:
			'Price class the requests asked for: general, high_memory or gpu_<type>',
	})
	priceClass: string;

	@ApiProperty({
		enum: Continent,
		enumName: 'Continent',
		nullable: true,
		description: 'Continent the requests were limited to; null when any',
	})
	continent: Continent | null;

	@ApiProperty({
		description: 'Sandbox requests no machine could take in the last 7 days',
	})
	requests: number;

	@ApiProperty({ description: 'vCPUs those requests asked for in total' })
	vcpus: number;

	@ApiProperty({ description: 'GPUs those requests asked for in total' })
	gpus: number;
}
