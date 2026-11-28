/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import {
	BASIS_POINTS_SCALE,
	MICRO_USD_PATTERN,
} from '../../common/constants/money.constants';
import { PageLimit } from '../../common/decorators/page-limit.decorator';
import { TimeBound } from '../../common/decorators/time-bound.decorator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { AutomaticPaymentsGapDto } from '../../settlement/dto/automatic-payments.dto';
import {
	AccountFundingState,
	BILLING_USAGE_QUERY,
	BillingAdmissionBlocker,
	BillingBudgetMode,
	BillingEvidenceStatus,
	BillingExportFormat,
	BillingForecastConfidence,
	BillingForecastMethod,
	BillingLineCategory,
	DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
	SandboxBillingState,
} from '../constants/billing.constants';
import {
	SandboxUsageSort,
	SandboxUsageSortDirection,
} from '../queries/sandbox-usage.query';
import type { BillingLineQuantities } from '../schemas/billing-line-quantities.schema';
import type { BillingLineConsumedQuantities } from '../types/billing-line.types';

const billingBudgetModes = Object.values(BillingBudgetMode);
const billingExportFormats = Object.values(BillingExportFormat);
const sandboxUsageSorts = Object.values(SandboxUsageSort);
const sandboxUsageSortDirections = Object.values(SandboxUsageSortDirection);
const SANDBOX_USAGE_SEARCH_MAXIMUM_LENGTH = 255;

const SERVICE_WINDOW_FROM =
	'Includes lines whose service ends at or after this instant';
const SERVICE_WINDOW_TO =
	'Includes lines whose service ends before this instant';

export class BillingMoneyBreakdownDto {
	@ApiProperty() actualMicroUsd: string;
	@ApiProperty() committedMicroUsd: string;
	@ApiProperty() forecastMicroUsd: string;
	@ApiProperty({ enum: BillingForecastMethod })
	forecastMethod: BillingForecastMethod;
	@ApiProperty({ enum: BillingForecastConfidence })
	forecastConfidence: BillingForecastConfidence;
	@ApiProperty() forecastObservationDays: number;
	@ApiPropertyOptional() limitMicroUsd?: string;
	@ApiPropertyOptional() utilizationBasisPoints?: number;
	@ApiPropertyOptional({
		description:
			'Share of the limit at which spend is flagged, when a limit is set.',
	})
	warningThresholdBasisPoints?: number;
}

export class BillingFundingDto {
	@ApiProperty({ description: 'Free escrow balance of the funding wallet' })
	freeMicroUsd: string;
	@ApiProperty({
		description:
			'Requested for withdrawal: hosts may still claim it, but it no longer counts as spendable',
	})
	pendingWithdrawalMicroUsd: string;
	@ApiProperty({
		description: 'Issued to hosts and Snapflow and not claimed yet',
	})
	outstandingMicroUsd: string;
	@ApiProperty({
		description: 'What new usage may draw on: free less outstanding',
	})
	spendableMicroUsd: string;
	@ApiProperty({
		description: 'Sandboxes as they run or sit stopped on their hosts',
	})
	computeMicroUsdPerHour: string;
	@ApiProperty({
		description: 'What the organization keeps in Snapflow storage',
	})
	storageMicroUsdPerHour: string;
	@ApiProperty() currentBurnMicroUsdPerHour: string;
	@ApiPropertyOptional({
		description:
			'Seconds the spendable balance lasts at the current burn; absent while nothing burns',
	})
	runwaySeconds?: string;
	@ApiProperty({ enum: AccountFundingState })
	state: AccountFundingState;
	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description: 'When compute stopped because the balance ran out',
	})
	computeStoppedAt?: Date;
	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description:
			'When the archives kept since compute stopped are deleted unless the balance is funded again',
	})
	archivesDeleteAt?: Date;
}

export class BillingOverviewDto {
	@ApiProperty({ type: BillingFundingDto }) funding: BillingFundingDto;
	@ApiProperty({ type: BillingMoneyBreakdownDto })
	month: BillingMoneyBreakdownDto;
	@ApiProperty({ enum: BillingAdmissionBlocker, isArray: true })
	admissionBlockers: BillingAdmissionBlocker[];
	@ApiProperty({
		type: AutomaticPaymentsGapDto,
		nullable: true,
		description:
			'Why Snapflow cannot pay hosts automatically for new sandboxes; null while automatic payments cover them or no funding wallet is linked',
	})
	automaticPayments: AutomaticPaymentsGapDto | null;
	@ApiProperty({ type: () => BillingDailyCostDto, isArray: true })
	daily: BillingDailyCostDto[];
	@ApiProperty({ type: String, format: 'date-time' }) observedAt: Date;
}

export class SandboxBillingSummaryDto {
	@ApiProperty({ enum: SandboxBillingState }) state: SandboxBillingState;
	@ApiPropertyOptional({ format: 'uuid' }) placementId?: string;
	@ApiPropertyOptional() assignmentGeneration?: number;
	@ApiPropertyOptional() estimatedHourlyMicroUsd?: string;
	@ApiPropertyOptional() liveAccrualMicroUsd?: string;
}

export class BillingDailyCostDto {
	@ApiProperty({ example: '2026-09-04' }) date: string;
	@ApiProperty() totalMicroUsd: string;
}

export class BillingLineItemDto {
	@ApiProperty() id: string;
	@ApiProperty({ format: 'uuid' }) customerOrganizationId: string;
	@ApiProperty() sandboxId: string;
	@ApiProperty() placementId: string;
	@ApiProperty() machineId: string;
	@ApiPropertyOptional() hostOrganizationId?: string;
	@ApiProperty() resourceSku: string;
	@ApiProperty({
		enum: BillingLineCategory,
		description:
			'compute: the sandbox ran; storage: the sandbox sat stopped and only its disk was charged',
	})
	category: BillingLineCategory;
	@ApiProperty({ type: String, format: 'date-time' }) periodStart: Date;
	@ApiProperty({ type: String, format: 'date-time' }) periodEnd: Date;
	@ApiProperty() grossMicroUsd: string;
	@ApiProperty() adjustmentMicroUsd: string;
	@ApiProperty() effectiveMicroUsd: string;
	@ApiProperty({ type: Object, additionalProperties: { type: 'string' } })
	consumedQuantities: BillingLineConsumedQuantities;
	@ApiPropertyOptional({ format: 'uuid' }) placementPriceId?: string;
	@ApiPropertyOptional({
		type: Object,
		additionalProperties: { type: 'string' },
		description: 'Priced resource-milliseconds of a compute line',
	})
	quantities?: BillingLineQuantities;
	@ApiProperty({ enum: BillingEvidenceStatus })
	evidenceStatus: BillingEvidenceStatus;
	@ApiProperty() contentDigest: string;
	@ApiPropertyOptional() reconciliationReason?: string;
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	reconciledAt?: Date;
	@ApiProperty() sourceType: string;
	@ApiProperty() sourceId: string;
	@ApiProperty() schemaVersion: number;
}

export class BillingLineItemPageDto extends CursorPageDto<BillingLineItemDto> {
	@ApiProperty({ type: BillingLineItemDto, isArray: true })
	declare items: BillingLineItemDto[];
}

export class BillingEvidenceCountsDto
	implements Record<BillingEvidenceStatus, number>
{
	@ApiProperty({ type: 'integer' }) pending: number;
	@ApiProperty({ type: 'integer' }) corroborated: number;
}

export class BillingSandboxUsageDto {
	@ApiProperty() sandboxId: string;
	@ApiPropertyOptional({
		description: 'Omitted once the sandbox has been deleted.',
	})
	sandboxName?: string;
	@ApiProperty() totalMicroUsd: string;
	@ApiProperty({ type: 'integer' }) lineCount: number;
	@ApiProperty({ type: String, format: 'date-time' }) firstServiceStart: Date;
	@ApiProperty({ type: String, format: 'date-time' }) lastServiceThrough: Date;
	@ApiProperty({ type: BillingEvidenceCountsDto })
	evidence: BillingEvidenceCountsDto;
}

export class BillingSandboxUsagePageDto extends CursorPageDto<BillingSandboxUsageDto> {
	@ApiProperty({ type: BillingSandboxUsageDto, isArray: true })
	declare items: BillingSandboxUsageDto[];

	@ApiProperty({
		description: 'Effective usage of every sandbox matching the filter',
	})
	totalMicroUsd: string;
}

export class ListBillingUsageQueryDto extends CursorPageQueryDto {
	@PageLimit(BILLING_USAGE_QUERY.defaultLimit, BILLING_USAGE_QUERY.maximumLimit)
	override limit = BILLING_USAGE_QUERY.defaultLimit;

	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID()
	sandboxId?: string;

	@TimeBound(SERVICE_WINDOW_FROM)
	from?: Date;

	@TimeBound(SERVICE_WINDOW_TO)
	to?: Date;
}

export class ListBillingSandboxUsageQueryDto extends CursorPageQueryDto {
	@PageLimit(BILLING_USAGE_QUERY.defaultLimit, BILLING_USAGE_QUERY.maximumLimit)
	override limit = BILLING_USAGE_QUERY.defaultLimit;

	@ApiPropertyOptional({
		maxLength: SANDBOX_USAGE_SEARCH_MAXIMUM_LENGTH,
		description: 'Case-insensitive part of the sandbox name or ID',
	})
	@IsOptional()
	@IsString()
	@MaxLength(SANDBOX_USAGE_SEARCH_MAXIMUM_LENGTH)
	search?: string;

	@ApiPropertyOptional({
		enum: SandboxUsageSort,
		default: SandboxUsageSort.LAST_ACTIVITY,
	})
	@IsOptional()
	@IsIn(sandboxUsageSorts)
	sort: SandboxUsageSort = SandboxUsageSort.LAST_ACTIVITY;

	@ApiPropertyOptional({
		enum: SandboxUsageSortDirection,
		default: SandboxUsageSortDirection.DESC,
	})
	@IsOptional()
	@IsIn(sandboxUsageSortDirections)
	direction: SandboxUsageSortDirection = SandboxUsageSortDirection.DESC;

	@TimeBound(SERVICE_WINDOW_FROM)
	from?: Date;

	@TimeBound(SERVICE_WINDOW_TO)
	to?: Date;
}

export class ExportBillingQueryDto {
	@ApiPropertyOptional({
		enum: BillingExportFormat,
		default: BillingExportFormat.CSV,
	})
	@IsOptional()
	@IsIn(billingExportFormats)
	format: BillingExportFormat = BillingExportFormat.CSV;

	@TimeBound(SERVICE_WINDOW_FROM)
	from?: Date;

	@TimeBound(SERVICE_WINDOW_TO)
	to?: Date;
}

export class BillingBudgetDto {
	@ApiProperty() resourceVersion: number;
	@ApiPropertyOptional() monthlyLimitMicroUsd?: string;
	@ApiProperty({ enum: BillingBudgetMode }) mode: BillingBudgetMode;
	@ApiProperty() warningThresholdBasisPoints: number;
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	updatedAt?: Date;
}

export class UpdateBillingBudgetDto {
	@ApiProperty({ type: String })
	@Matches(MICRO_USD_PATTERN)
	monthlyLimitMicroUsd: string;

	@ApiProperty({ enum: BillingBudgetMode })
	@IsIn(billingBudgetModes)
	mode: BillingBudgetMode;

	@ApiProperty({
		type: Number,
		minimum: 1,
		maximum: BASIS_POINTS_SCALE,
		default: DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
	})
	@IsInt()
	@Min(1)
	@Max(BASIS_POINTS_SCALE)
	warningThresholdBasisPoints = DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS;
}
