/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import { ExposureCutoverDto } from '../dto/exposure-cutover.dto';
import { ExposureCutoverService } from '../services/exposure/exposure-cutover.service';

@Controller('admin/exposure-cutovers')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminExposureCutoverController {
	constructor(private readonly cutovers: ExposureCutoverService) {}

	@Get()
	@ApiOperation({
		summary: 'List acknowledged Edge cutover candidates',
		operationId: 'adminListExposureCutovers',
	})
	@ApiResponse({ status: HttpStatus.OK, type: [ExposureCutoverDto] })
	async list(): Promise<ExposureCutoverDto[]> {
		const cutovers = await this.cutovers.list();
		return cutovers.map((cutover) => ExposureCutoverDto.from(cutover));
	}

	@Post(':backendId/begin')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Begin a version-fenced Edge DNS cutover',
		operationId: 'adminBeginExposureCutover',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ExposureCutoverDto })
	async begin(
		@Param('backendId', ParseUUIDPipe) backendId: string
	): Promise<ExposureCutoverDto> {
		return ExposureCutoverDto.from(await this.cutovers.begin(backendId));
	}

	@Post(':backendId/verify')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Verify canary SLOs and activate an Edge cutover',
		operationId: 'adminVerifyExposureCutover',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ExposureCutoverDto })
	async verify(
		@Param('backendId', ParseUUIDPipe) backendId: string
	): Promise<ExposureCutoverDto> {
		return ExposureCutoverDto.from(await this.cutovers.verify(backendId));
	}

	@Post(':backendId/rollback')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Restore the acknowledged predecessor for an Edge cutover',
		operationId: 'adminRollbackExposureCutover',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ExposureCutoverDto })
	async rollback(
		@Param('backendId', ParseUUIDPipe) backendId: string
	): Promise<ExposureCutoverDto> {
		return ExposureCutoverDto.from(await this.cutovers.rollback(backendId));
	}
}
