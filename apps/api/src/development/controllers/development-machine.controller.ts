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
	UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { CustomHeaders } from '../../common/constants/header.constants';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import {
	MachineEnrollmentDto,
	MachineEnrollmentProofDto,
} from '../../machine/dto/machine-enrollment.dto';
import { DevelopmentMachineEnrollmentGuard } from '../guards/development-machine-enrollment.guard';
import { DevelopmentMachineEnrollmentService } from '../services/development-machine-enrollment.service';

@Controller('development/machines')
@ApiTags(OpenApiTag.DEVELOPMENT)
@PublicEndpoint()
@UseGuards(DevelopmentMachineEnrollmentGuard)
export class DevelopmentMachineController {
	constructor(
		private readonly enrollments: DevelopmentMachineEnrollmentService
	) {}

	@Post('enroll')
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.DEVELOPMENT_ENROLLMENT_SECRET)
	@ApiOperation({
		summary:
			'Enroll the local development machine under the development administrator with its identity and host keys; repeating it with the same keys returns the same machine. Available only in the development deployment',
		operationId: 'enrollDevelopmentMachine',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineEnrollmentDto })
	enroll(
		@Body() input: MachineEnrollmentProofDto,
		@Req() request: Request
	): Promise<MachineEnrollmentDto> {
		return this.enrollments.enroll(input, request.ip);
	}
}
