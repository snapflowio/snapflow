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
import {
	ArrayMaxSize,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsIP,
	IsUUID,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { ABUSE_REPORT_LIMITS } from '../constants/abuse.constants';
import {
	CONNECTION_RECORDS,
	IspComplaintProtocol,
} from '../constants/isp-complaint.constants';

const MAXIMUM_PORT = 65_535;

@ApiSchema({ name: 'MachineConnectionFlow' })
export class MachineConnectionFlowDto {
	@ApiProperty({ description: 'Destination outside the machine' })
	@IsIP()
	destinationAddress: string;

	@ApiProperty({
		type: 'integer',
		minimum: 0,
		maximum: MAXIMUM_PORT,
		description: 'Destination port; 0 for ICMP',
	})
	@IsInt()
	@Min(0)
	@Max(MAXIMUM_PORT)
	destinationPort: number;

	@ApiProperty({
		enum: IspComplaintProtocol,
		enumName: 'ConnectionProtocol',
	})
	@IsEnum(IspComplaintProtocol)
	protocol: IspComplaintProtocol;

	@ApiProperty({ type: String, format: 'date-time' })
	@IsDateString({ strict: true })
	firstSeenAt: string;

	@ApiProperty({ type: String, format: 'date-time' })
	@IsDateString({ strict: true })
	lastSeenAt: string;
}

abstract class WorkloadConnectionsDto {
	@ApiProperty({
		type: [MachineConnectionFlowDto],
		maxItems: CONNECTION_RECORDS.maximumPerReport,
	})
	@ArrayMaxSize(CONNECTION_RECORDS.maximumPerReport)
	@ValidateNested({ each: true })
	@Type(() => MachineConnectionFlowDto)
	flows: MachineConnectionFlowDto[];

	@ApiProperty({
		description:
			'The workload reached more destinations than the machine records in one report, so some of its flows are missing',
	})
	@IsBoolean()
	overflowed: boolean;
}

@ApiSchema({ name: 'MachineSandboxConnections' })
export class MachineSandboxConnectionsDto extends WorkloadConnectionsDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	sandboxId: string;
}

@ApiSchema({ name: 'MachineBuilderConnections' })
export class MachineBuilderConnectionsDto extends WorkloadConnectionsDto {
	@ApiProperty({
		format: 'uuid',
		description: 'The image builder VM that opened the flows',
	})
	@IsUUID()
	builderId: string;

	@ApiProperty({
		format: 'uuid',
		description: 'The organization whose image builds the builder runs',
	})
	@IsUUID()
	organizationId: string;
}

@ApiSchema({ name: 'MachineConnectionReport' })
export class MachineConnectionReportDto {
	@ApiProperty({
		type: [MachineSandboxConnectionsDto],
		maxItems: ABUSE_REPORT_LIMITS.maximumSandboxes,
		description:
			'Destinations each sandbox reached since the last report; metadata only, no payload',
	})
	@ArrayMaxSize(ABUSE_REPORT_LIMITS.maximumSandboxes)
	@ValidateNested({ each: true })
	@Type(() => MachineSandboxConnectionsDto)
	sandboxes: MachineSandboxConnectionsDto[];

	@ApiProperty({
		type: [MachineBuilderConnectionsDto],
		maxItems: ABUSE_REPORT_LIMITS.maximumSandboxes,
		description:
			'Destinations each image builder reached since the last report; metadata only, no payload',
	})
	@ArrayMaxSize(ABUSE_REPORT_LIMITS.maximumSandboxes)
	@ValidateNested({ each: true })
	@Type(() => MachineBuilderConnectionsDto)
	builders: MachineBuilderConnectionsDto[];

	@ApiProperty({
		type: String,
		format: 'date-time',
		description: 'Start of the period this report covers',
	})
	@IsDateString({ strict: true })
	windowStart: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description: 'End of the period this report covers',
	})
	@IsDateString({ strict: true })
	windowEnd: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description:
			'When the machine sent this report by its own clock, so the control plane can reject periods measured by a skewed clock',
	})
	@IsDateString({ strict: true })
	sentAt: string;

	@ApiProperty({
		description:
			'The machine sampled every sandbox throughout the period and this is the last report for it, so the reports for the period hold every flow',
	})
	@IsBoolean()
	complete: boolean;
}
