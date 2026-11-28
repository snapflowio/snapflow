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
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	StreamableFile,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiProduces,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { ISP_STATEMENT_FILE } from '../constants/isp-complaint.constants';
import { IspComplaintDto } from '../dto/abuse-report.dto';
import { CreateIspComplaintDto } from '../dto/abuse-report-intake.dto';
import { IspComplaintService } from '../services/isp-complaint.service';

const MACHINE_ID_PARAM = {
	name: 'machineId',
	description: 'Machine ID',
	type: String,
} as const;

@Controller('machines/:machineId/isp-complaints')
@ApiTags(OpenApiTag.MACHINES)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
export class HostIspComplaintController {
	constructor(private readonly complaints: IspComplaintService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@RequiredOrganizationPermissions({ machines: ['write'] })
	@ApiOperation({
		summary:
			"Forward an ISP abuse complaint about this machine's public address; Snapflow matches it against its sandboxes' connection records",
		operationId: 'createIspComplaint',
	})
	@ApiParam(MACHINE_ID_PARAM)
	@ApiResponse({ status: HttpStatus.CREATED, type: IspComplaintDto })
	create(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string,
		@Body() complaint: CreateIspComplaintDto
	): Promise<IspComplaintDto> {
		return this.complaints.create(
			machineId,
			context.organizationId,
			context.userId,
			complaint
		);
	}

	@Get()
	@RequiredOrganizationPermissions({ machines: ['read'] })
	@ApiOperation({
		summary: 'List the ISP complaints forwarded for this machine, newest first',
		operationId: 'listIspComplaints',
	})
	@ApiParam(MACHINE_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: [IspComplaintDto] })
	list(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string
	): Promise<IspComplaintDto[]> {
		return this.complaints.list(machineId, context.organizationId);
	}

	@Get(':reportId/statement')
	@RequiredOrganizationPermissions({ machines: ['read'] })
	@Header('Content-Type', ISP_STATEMENT_FILE.contentType)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary:
			'Download the PDF statement on a forwarded complaint for the ISP; it names no customer',
		operationId: 'downloadIspComplaintStatement',
	})
	@ApiParam(MACHINE_ID_PARAM)
	@ApiParam({ name: 'reportId', description: 'Complaint ID', type: String })
	@ApiProduces(ISP_STATEMENT_FILE.contentType)
	@ApiResponse({
		status: HttpStatus.OK,
		schema: { type: 'string', format: 'binary' },
	})
	async statement(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string,
		@Param('reportId', ParseUUIDPipe) reportId: string
	): Promise<StreamableFile> {
		const pdf = await this.complaints.statement(
			machineId,
			context.organizationId,
			reportId
		);
		return new StreamableFile(pdf, {
			disposition: `attachment; filename="${ISP_STATEMENT_FILE.namePrefix}${reportId}.pdf"`,
		});
	}
}
