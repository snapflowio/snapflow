/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsMachineAuthContext } from '../../common/decorators/auth-context.decorator';
import { SessionGuarded } from '../../common/decorators/session-guarded.decorator';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import { MachineSessionGuard } from '../../machine/guards/machine-session.guard';
import { CONNECTION_REPORT_ROUTE } from '../constants/isp-complaint.constants';
import { MachineAbuseReportDto } from '../dto/machine-abuse-report.dto';
import { MachineConnectionReportDto } from '../dto/machine-connection-report.dto';
import { AbuseReportService } from '../services/abuse-report.service';
import { IspComplaintService } from '../services/isp-complaint.service';

@Controller(CONNECTION_REPORT_ROUTE.controller)
@ApiTags(OpenApiTag.MACHINES)
@PublicEndpoint()
@SessionGuarded(MachineSessionGuard)
export class MachineAbuseReportController {
	constructor(
		private readonly reports: AbuseReportService,
		private readonly complaints: IspComplaintService
	) {}

	@Put('abuse-signals')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary:
			'Report the abuse signals the machine saw from its sandboxes since its last report',
		operationId: 'reportMachineAbuseSignals',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	reportAbuseSignals(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() report: MachineAbuseReportDto
	): Promise<void> {
		return this.reports.record(machineContext.machineId, report);
	}

	@Put(CONNECTION_REPORT_ROUTE.path)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary:
			'Report the destinations each sandbox reached since the last report, so ISP abuse complaints can be attributed',
		operationId: 'reportMachineConnections',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	reportConnections(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() report: MachineConnectionReportDto
	): Promise<void> {
		return this.complaints.ingestConnections(machineContext.machineId, report);
	}
}
