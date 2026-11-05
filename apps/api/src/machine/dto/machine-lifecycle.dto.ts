/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMachineSchedulingDto {
	@ApiProperty({
		description: 'Whether the machine must be excluded from new placements',
	})
	@IsBoolean()
	unschedulable: boolean;
}

export class UpdateMachineDrainingDto {
	@ApiProperty({
		description: 'Whether the machine should drain its existing workloads',
	})
	@IsBoolean()
	draining: boolean;
}
