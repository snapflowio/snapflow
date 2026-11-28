/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import {
	BYTE_COUNT_PATTERN,
	MACHINE_DIAGNOSTIC_CHECK_NAME_PATTERN,
	MACHINE_HOST_REPORT_LIMITS,
	TRAFFIC_MONTH_PATTERN,
} from '../constants/machine-host-report.constants';
import { MachineDiagnosticStatus } from '../enums/machine-diagnostic-status.enum';
import { MachinePaymentHoldReason } from '../enums/machine-payment-hold-reason.enum';

const TIMESTAMP = { format: 'date-time' } as const;
const COUNTER = { type: 'integer', format: 'int64', minimum: 0 } as const;
const TEXT_LIMIT = MACHINE_HOST_REPORT_LIMITS.maximumTextLength;
const BENCHMARK_FIELD_LIMIT =
	MACHINE_HOST_REPORT_LIMITS.maximumBenchmarkFieldLength;

@ApiSchema({ name: 'MachineDiagnosticCheck' })
class MachineDiagnosticCheckDto {
	@ApiProperty({
		description: 'Check name, as `snapflow doctor --json` reports it',
		pattern: MACHINE_DIAGNOSTIC_CHECK_NAME_PATTERN.source,
		maxLength: MACHINE_HOST_REPORT_LIMITS.maximumCheckNameLength,
	})
	@IsString()
	@MaxLength(MACHINE_HOST_REPORT_LIMITS.maximumCheckNameLength)
	@Matches(MACHINE_DIAGNOSTIC_CHECK_NAME_PATTERN)
	name: string;

	@ApiProperty({
		enum: MachineDiagnosticStatus,
		enumName: 'MachineDiagnosticStatus',
	})
	@IsEnum(MachineDiagnosticStatus)
	status: MachineDiagnosticStatus;

	@ApiProperty({
		description: 'Whether the machine cannot serve sandboxes until it passes',
	})
	@IsBoolean()
	required: boolean;

	@ApiProperty({ maxLength: TEXT_LIMIT })
	@IsString()
	@MaxLength(TEXT_LIMIT)
	detail: string;

	@ApiPropertyOptional({
		description: 'What the host should do when the check did not pass',
		maxLength: TEXT_LIMIT,
	})
	@IsOptional()
	@IsString()
	@MaxLength(TEXT_LIMIT)
	remediation?: string;
}

@ApiSchema({ name: 'MachineDiagnostics' })
export class MachineDiagnosticsDto {
	@ApiProperty({ description: 'True when every required check passed' })
	@IsBoolean()
	ready: boolean;

	@ApiProperty({
		type: [MachineDiagnosticCheckDto],
		maxItems: MACHINE_HOST_REPORT_LIMITS.maximumChecks,
	})
	@ArrayMaxSize(MACHINE_HOST_REPORT_LIMITS.maximumChecks)
	@ValidateNested({ each: true })
	@Type(() => MachineDiagnosticCheckDto)
	checks: MachineDiagnosticCheckDto[];

	@ApiProperty({ ...TIMESTAMP, description: 'When the machine ran the checks' })
	@IsDateString({ strict: true })
	checkedAt: string;
}

@ApiSchema({ name: 'MachinePaymentHold' })
class MachinePaymentHoldDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	sandboxId: string;

	@ApiProperty({
		enum: MachinePaymentHoldReason,
		enumName: 'MachinePaymentHoldReason',
	})
	@IsEnum(MachinePaymentHoldReason)
	reason: MachinePaymentHoldReason;

	@ApiProperty({
		description: 'The amounts or window behind the reason',
		maxLength: TEXT_LIMIT,
	})
	@IsString()
	@MaxLength(TEXT_LIMIT)
	detail: string;

	@ApiProperty({ ...TIMESTAMP, description: 'When the machine held it' })
	@IsDateString({ strict: true })
	heldAt: string;
}

@ApiSchema({ name: 'MachinePaymentHolds' })
export class MachinePaymentHoldsDto {
	@ApiProperty({
		type: [MachinePaymentHoldDto],
		description: 'Sandboxes the machine paused until their customers pay',
		maxItems: MACHINE_HOST_REPORT_LIMITS.maximumHolds,
	})
	@ArrayMaxSize(MACHINE_HOST_REPORT_LIMITS.maximumHolds)
	@ValidateNested({ each: true })
	@Type(() => MachinePaymentHoldDto)
	holds: MachinePaymentHoldDto[];

	@ApiProperty({
		...TIMESTAMP,
		description: 'When the machine read its holds',
	})
	@IsDateString({ strict: true })
	observedAt: string;
}

@ApiSchema({ name: 'MachineMeasurementDistribution' })
class MachineMeasurementDistributionDto {
	@ApiProperty(COUNTER)
	@IsInt()
	@Min(0)
	p50: number;

	@ApiProperty(COUNTER)
	@IsInt()
	@Min(0)
	p95: number;

	@ApiProperty(COUNTER)
	@IsInt()
	@Min(0)
	p99: number;
}

function distribution(description: string) {
	return { type: MachineMeasurementDistributionDto, description };
}

@ApiSchema({ name: 'MachineLocalBenchmark' })
export class MachineLocalBenchmarkDto {
	@ApiProperty({ maxLength: BENCHMARK_FIELD_LIMIT })
	@IsString()
	@MaxLength(BENCHMARK_FIELD_LIMIT)
	schema: string;

	@ApiProperty(TIMESTAMP)
	@IsDateString({ strict: true })
	recordedAt: string;

	@ApiProperty({ maxLength: BENCHMARK_FIELD_LIMIT })
	@IsString()
	@MaxLength(BENCHMARK_FIELD_LIMIT)
	architecture: string;

	@ApiProperty({ maxLength: BENCHMARK_FIELD_LIMIT })
	@IsString()
	@MaxLength(BENCHMARK_FIELD_LIMIT)
	kernel: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	logicalCpus: number;

	@ApiProperty({
		type: 'integer',
		minimum: 1,
		maximum: MACHINE_HOST_REPORT_LIMITS.maximumBenchmarkSamples,
	})
	@IsInt()
	@Min(1)
	@Max(MACHINE_HOST_REPORT_LIMITS.maximumBenchmarkSamples)
	samples: number;

	@ApiProperty({ maxLength: BENCHMARK_FIELD_LIMIT })
	@IsString()
	@MaxLength(BENCHMARK_FIELD_LIMIT)
	releaseVersion: string;

	@ApiProperty({ maxLength: BENCHMARK_FIELD_LIMIT })
	@IsString()
	@MaxLength(BENCHMARK_FIELD_LIMIT)
	releaseBundleDigest: string;

	@ApiProperty(COUNTER)
	@IsInt()
	@Min(0)
	releaseAssetBytes: number;

	@ApiProperty({ maxLength: BENCHMARK_FIELD_LIMIT })
	@IsString()
	@MaxLength(BENCHMARK_FIELD_LIMIT)
	cacheState: string;

	@ApiProperty(distribution('Time to verify the installed release'))
	@ValidateNested()
	@Type(() => MachineMeasurementDistributionDto)
	releaseVerificationNanos: MachineMeasurementDistributionDto;

	@ApiProperty(distribution('Storage write throughput'))
	@ValidateNested()
	@Type(() => MachineMeasurementDistributionDto)
	storageWriteBytesPerSecond: MachineMeasurementDistributionDto;

	@ApiProperty(distribution('Storage read throughput'))
	@ValidateNested()
	@Type(() => MachineMeasurementDistributionDto)
	storageReadBytesPerSecond: MachineMeasurementDistributionDto;

	@ApiProperty(distribution('Latency of the API health endpoint'))
	@ValidateNested()
	@Type(() => MachineMeasurementDistributionDto)
	apiHealthLatencyNanos: MachineMeasurementDistributionDto;
}

@ApiSchema({ name: 'MachineTrafficReport' })
export class MachineTrafficReportDto {
	@ApiProperty({
		description: 'The UTC month the count covers, as YYYY-MM',
		pattern: TRAFFIC_MONTH_PATTERN.source,
		example: '2026-11',
	})
	@Matches(TRAFFIC_MONTH_PATTERN)
	month: string;

	@ApiProperty({
		description:
			'Bytes every sandbox on the machine sent and received this month, as a decimal string',
		pattern: BYTE_COUNT_PATTERN.source,
	})
	@Matches(BYTE_COUNT_PATTERN)
	bytes: string;

	@ApiProperty({
		...TIMESTAMP,
		description: 'When the machine read its counters',
	})
	@IsDateString({ strict: true })
	observedAt: string;
}
