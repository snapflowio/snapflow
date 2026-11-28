/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS } from '../../infra/control-wake/constants/control-wake.constants';
import { SandboxState } from '../enums/sandbox-state.enum';

@ApiSchema({ name: 'AwaitSandboxStateChangeQuery' })
export class AwaitSandboxStateChangeQueryDto {
	@ApiProperty({
		description: 'The state the caller last observed',
		enum: SandboxState,
		enumName: 'SandboxState',
	})
	@IsEnum(SandboxState)
	observedState: SandboxState;

	@ApiProperty({
		description:
			'How long to wait for the state to change before returning the unchanged sandbox',
		type: 'integer',
		minimum: 0,
		maximum: CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS,
	})
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS)
	waitSeconds: number;
}
