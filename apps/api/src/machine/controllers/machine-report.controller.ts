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
import {
	MachineDiagnosticsDto,
	MachineLocalBenchmarkDto,
	MachinePaymentHoldsDto,
	MachineTrafficReportDto,
} from '../dto/machine-host-report.dto';
import { MachineSessionGuard } from '../guards/machine-session.guard';
import { MachineHostReportService } from '../services/reports/machine-host-report.service';
import { MachineTrafficService } from '../services/reports/machine-traffic.service';

@Controller('machines/reports/v1')
@ApiTags(OpenApiTag.MACHINES)
@PublicEndpoint()
@SessionGuarded(MachineSessionGuard)
export class MachineReportController {
	constructor(
		private readonly reports: MachineHostReportService,
		private readonly traffic: MachineTrafficService
	) {}

	@Put('traffic')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary:
			"Report the machine's sandbox traffic this UTC month, checked against the host's monthly traffic cap",
		operationId: 'reportMachineTraffic',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	reportTraffic(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() report: MachineTrafficReportDto
	): Promise<void> {
		return this.traffic.record(machineContext.machineId, report);
	}

	@Put('diagnostics')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary:
			'Report the checks `snapflow doctor` runs, as the machine last ran them',
		operationId: 'reportMachineDiagnostics',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	reportDiagnostics(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() diagnostics: MachineDiagnosticsDto
	): Promise<void> {
		return this.reports.recordDiagnostics(
			machineContext.machineId,
			diagnostics
		);
	}

	@Put('payment-holds')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary:
			'Report the sandboxes the machine paused until their customers pay, and why',
		operationId: 'reportMachinePaymentHolds',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	reportPaymentHolds(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() holds: MachinePaymentHoldsDto
	): Promise<void> {
		return this.reports.recordPaymentHolds(machineContext.machineId, holds);
	}

	@Put('benchmark')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Report the latest `snapflow doctor --benchmark` measurements',
		operationId: 'reportMachineLocalBenchmark',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	reportLocalBenchmark(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() benchmark: MachineLocalBenchmarkDto
	): Promise<void> {
		return this.reports.recordLocalBenchmark(
			machineContext.machineId,
			benchmark
		);
	}
}
