/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
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
import { AuditLogDto } from '../dto/audit-log.dto';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import { AuditLogPageDto } from '../dto/paginated-audit-logs.dto';
import { AuditService } from '../services/audit.service';

@Controller('admin/audit')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminAuditController {
	constructor(private readonly auditService: AuditService) {}

	@Get()
	@ApiOperation({
		summary: 'Get all audit logs',
		operationId: 'adminGetAllAuditLogs',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Paginated list of all audit logs',
		type: AuditLogPageDto,
	})
	async getAllLogs(
		@Query() query: ListAuditLogsQueryDto
	): Promise<AuditLogPageDto> {
		const result = await this.auditService.getAllLogs(
			query.limit,
			{
				from: query.from,
				to: query.to,
			},
			query.cursor
		);
		return {
			...result,
			items: result.items.map(AuditLogDto.from),
		};
	}
}
