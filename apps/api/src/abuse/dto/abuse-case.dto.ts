/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiProperty,
	ApiPropertyOptional,
	ApiSchema,
	PickType,
} from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { AbuseCaseStatus, AbuseSignalKind } from '../constants/abuse.constants';
import type { AbuseCase } from '../entities/abuse-case.entity';
import { MachineAbuseFindingDto } from './machine-abuse-report.dto';

const NULLABLE_TIMESTAMP = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

@ApiSchema({ name: 'AbuseFinding' })
export class AbuseFindingDto extends PickType(MachineAbuseFindingDto, [
	'kind',
	'severity',
	'count',
	'detail',
] as const) {
	@ApiProperty({ type: String, format: 'date-time' })
	lastSeenAt: string;
}

@ApiSchema({ name: 'AbuseCase' })
export class AbuseCaseDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid' })
	sandboxId: string;

	@ApiProperty({ format: 'uuid' })
	organizationId: string;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	machineId: string | null;

	@ApiProperty({ enum: AbuseCaseStatus, enumName: 'AbuseCaseStatus' })
	status: AbuseCaseStatus;

	@ApiProperty({ type: [AbuseFindingDto] })
	findings: AbuseFindingDto[];

	@ApiProperty({ type: String, format: 'date-time' })
	firstSeenAt: string;

	@ApiProperty({ type: String, format: 'date-time' })
	lastSeenAt: string;

	@ApiProperty(NULLABLE_TIMESTAMP)
	throttledAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	notifiedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	suspendedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	resolvedAt: string | null;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	resolvedBy: string | null;

	@ApiProperty({
		description: 'Opened or acted on by a person; never released automatically',
	})
	manual: boolean;

	@ApiProperty(NULLABLE_TIMESTAMP)
	previewDisabledAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	egressBlockedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	pausedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	terminatedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	organizationSuspendedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	referredAt: string | null;

	static from(abuseCase: AbuseCase): AbuseCaseDto {
		return {
			id: abuseCase.id,
			sandboxId: abuseCase.sandboxId,
			organizationId: abuseCase.organizationId,
			machineId: abuseCase.machineId,
			status: abuseCase.status,
			findings: Object.values(AbuseSignalKind).flatMap((kind) => {
				const finding = abuseCase.findings[kind];
				return finding ? [{ kind, ...finding }] : [];
			}),
			firstSeenAt: abuseCase.firstSeenAt.toISOString(),
			lastSeenAt: abuseCase.lastSeenAt.toISOString(),
			throttledAt: abuseCase.throttledAt?.toISOString() ?? null,
			notifiedAt: abuseCase.notifiedAt?.toISOString() ?? null,
			suspendedAt: abuseCase.suspendedAt?.toISOString() ?? null,
			resolvedAt: abuseCase.resolvedAt?.toISOString() ?? null,
			resolvedBy: abuseCase.resolvedBy,
			manual: abuseCase.manual,
			previewDisabledAt: abuseCase.previewDisabledAt?.toISOString() ?? null,
			egressBlockedAt: abuseCase.egressBlockedAt?.toISOString() ?? null,
			pausedAt: abuseCase.pausedAt?.toISOString() ?? null,
			terminatedAt: abuseCase.terminatedAt?.toISOString() ?? null,
			organizationSuspendedAt:
				abuseCase.organizationSuspendedAt?.toISOString() ?? null,
			referredAt: abuseCase.referredAt?.toISOString() ?? null,
		};
	}
}

@ApiSchema({ name: 'AbuseCasePage' })
export class AbuseCasePageDto extends CursorPageDto<AbuseCaseDto> {
	@ApiProperty({ type: [AbuseCaseDto] })
	declare items: AbuseCaseDto[];
}

@ApiSchema({ name: 'AbuseCaseListQuery' })
export class AbuseCaseListQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		enum: AbuseCaseStatus,
		enumName: 'AbuseCaseStatus',
		description: 'Only cases in this status',
	})
	@IsOptional()
	@IsEnum(AbuseCaseStatus)
	status?: AbuseCaseStatus;
}
