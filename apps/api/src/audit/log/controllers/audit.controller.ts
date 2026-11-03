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
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { AuditLogDto } from '../dto/audit-log.dto';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import { AuditLogPageDto } from '../dto/paginated-audit-logs.dto';
import { AuditService } from '../services/audit.service';

@Controller('audit')
@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class AuditController {
	constructor(private readonly auditService: AuditService) {}

	@Get()
	@ApiOperation({
		summary: 'Get audit logs of the active organization',
		operationId: 'getAuditLogs',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Paginated list of the active organization audit logs',
		type: AuditLogPageDto,
	})
	@RequiredOrganizationPermissions({ audit_logs: ['read'] })
	async getLogs(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListAuditLogsQueryDto
	): Promise<AuditLogPageDto> {
		const result = await this.auditService.getOrganizationLogs(
			authContext.organizationId,
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
