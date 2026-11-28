/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import {
	EnrollMachineDto,
	MachineEnrollmentDto,
} from '../dto/machine-enrollment.dto';
import { MachineEnrollmentService } from '../services/enrollment/machine-enrollment.service';

@Controller('machines/enrollment/v1')
@ApiTags(OpenApiTag.MACHINES)
@PublicEndpoint()
export class MachineEnrollmentController {
	constructor(private readonly enrollments: MachineEnrollmentService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('machine-register')
	@ApiOperation({
		summary:
			"Enroll this machine into the enrollment key's organization with its identity and host keys; repeating it with the same keys returns the same machine",
		operationId: 'enrollMachine',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineEnrollmentDto })
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'The enrollment key is invalid, expired or revoked',
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The single-use key was already spent, or the keys are registered elsewhere',
	})
	enroll(
		@Body() input: EnrollMachineDto,
		@Req() request: Request
	): Promise<MachineEnrollmentDto> {
		return this.enrollments.enroll(input, request.ip);
	}
}
