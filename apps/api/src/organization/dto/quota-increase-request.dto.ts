/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { QUOTA_INCREASE_REQUEST } from '../constants/organization-quota-tier.constants';
import type { OrganizationQuotaIncreaseRequest } from '../entities/organization-quota-increase-request.entity';
import { QuotaIncreaseRequestStatus } from '../enums/quota-increase-request-status.enum';

const MINIMUM_QUANTITY = 0;

function RequestedQuantity(description: string) {
	return applyDecorators(
		ApiProperty({ description, minimum: MINIMUM_QUANTITY }),
		IsInt(),
		Min(MINIMUM_QUANTITY)
	);
}

@ApiSchema({ name: 'QuotaIncreaseRequest' })
export class QuotaIncreaseRequestDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid' })
	organizationId: string;

	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	sandboxClass: SandboxClass;

	@ApiProperty({ description: 'vCPUs requested in total' })
	requestedCpu: number;

	@ApiProperty({ description: 'GiB of memory requested in total' })
	requestedMemory: number;

	@ApiProperty({ description: 'GiB of disk requested in total' })
	requestedDisk: number;

	@ApiProperty({ description: 'GPUs requested in total' })
	requestedGpu: number;

	@ApiProperty()
	useCase: string;

	@ApiProperty({
		enum: QuotaIncreaseRequestStatus,
		enumName: 'QuotaIncreaseRequestStatus',
	})
	status: QuotaIncreaseRequestStatus;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	requestedBy: string | null;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	reviewedBy: string | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	reviewedAt: string | null;

	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Why the request was denied, or the note left on approval',
	})
	decisionReason: string | null;

	@ApiProperty({ format: 'date-time' })
	createdAt: string;

	static from(
		request: OrganizationQuotaIncreaseRequest
	): QuotaIncreaseRequestDto {
		return {
			id: request.id,
			organizationId: request.organizationId,
			sandboxClass: request.sandboxClass,
			requestedCpu: request.requestedCpu,
			requestedMemory: request.requestedMemory,
			requestedDisk: request.requestedDisk,
			requestedGpu: request.requestedGpu,
			useCase: request.useCase,
			status: request.status,
			requestedBy: request.requestedBy,
			reviewedBy: request.reviewedBy,
			reviewedAt: request.reviewedAt?.toISOString() ?? null,
			decisionReason: request.decisionReason,
			createdAt: request.createdAt.toISOString(),
		};
	}
}

@ApiSchema({ name: 'AdminQuotaIncreaseRequest' })
export class AdminQuotaIncreaseRequestDto extends QuotaIncreaseRequestDto {
	@ApiProperty({ type: String, nullable: true })
	organizationName: string | null;

	@ApiProperty({ description: 'Quota tier the organization holds' })
	organizationTier: number;
}

@ApiSchema({ name: 'AdminQuotaIncreaseRequestPage' })
export class AdminQuotaIncreaseRequestPageDto extends CursorPageDto<AdminQuotaIncreaseRequestDto> {
	@ApiProperty({ type: AdminQuotaIncreaseRequestDto, isArray: true })
	declare items: AdminQuotaIncreaseRequestDto[];
}

@ApiSchema({ name: 'ListQuotaIncreaseRequestsQuery' })
export class ListQuotaIncreaseRequestsQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		enum: QuotaIncreaseRequestStatus,
		enumName: 'QuotaIncreaseRequestStatus',
	})
	@IsOptional()
	@IsEnum(QuotaIncreaseRequestStatus)
	status?: QuotaIncreaseRequestStatus;
}

@ApiSchema({ name: 'CreateQuotaIncreaseRequest' })
export class CreateQuotaIncreaseRequestDto {
	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	@IsEnum(SandboxClass)
	sandboxClass: SandboxClass;

	@RequestedQuantity('vCPUs the organization needs in total')
	requestedCpu: number;

	@RequestedQuantity('GiB of memory the organization needs in total')
	requestedMemory: number;

	@RequestedQuantity('GiB of disk the organization needs in total')
	requestedDisk: number;

	@RequestedQuantity('GPUs the organization needs in total')
	requestedGpu: number;

	@ApiProperty({
		minLength: QUOTA_INCREASE_REQUEST.useCaseMinimumLength,
		maxLength: QUOTA_INCREASE_REQUEST.useCaseMaximumLength,
		description: 'What the organization runs and why it needs more',
	})
	@IsString()
	@MinLength(QUOTA_INCREASE_REQUEST.useCaseMinimumLength)
	@MaxLength(QUOTA_INCREASE_REQUEST.useCaseMaximumLength)
	useCase: string;
}

@ApiSchema({ name: 'ApproveQuotaIncreaseRequest' })
export class ApproveQuotaIncreaseRequestDto {
	@ApiPropertyOptional({
		maxLength: QUOTA_INCREASE_REQUEST.decisionReasonMaximumLength,
		description: 'Note recorded with the approval',
	})
	@IsOptional()
	@IsString()
	@MaxLength(QUOTA_INCREASE_REQUEST.decisionReasonMaximumLength)
	note?: string;
}

@ApiSchema({ name: 'DenyQuotaIncreaseRequest' })
export class DenyQuotaIncreaseRequestDto {
	@ApiProperty({
		maxLength: QUOTA_INCREASE_REQUEST.decisionReasonMaximumLength,
		description: 'Why the request is denied; emailed to the requester',
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(QUOTA_INCREASE_REQUEST.decisionReasonMaximumLength)
	reason: string;
}
