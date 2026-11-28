/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema, PickType } from '@nestjs/swagger';
import { AbuseReportCategory } from '../constants/abuse-report.constants';
import type { AbuseCaseActionRecord } from '../entities/abuse-case-action.entity';
import { AbuseCaseActionRecordDto } from './abuse-report.dto';

const NULLABLE_TIMESTAMP = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

@ApiSchema({ name: 'AbuseAppealAction' })
export class AbuseAppealActionDto extends PickType(AbuseCaseActionRecordDto, [
	'action',
	'createdAt',
] as const) {
	static from(record: AbuseCaseActionRecord): AbuseAppealActionDto {
		return {
			action: record.action,
			createdAt: record.createdAt.toISOString(),
		};
	}
}

@ApiSchema({ name: 'AbuseAppeal' })
export class AbuseAppealDto {
	@ApiProperty({ format: 'uuid' })
	caseId: string;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({
		enum: AbuseReportCategory,
		enumName: 'AbuseReportCategory',
		isArray: true,
		description: 'Categories of the reports that led to the actions',
	})
	categories: AbuseReportCategory[];

	@ApiProperty({ type: AbuseAppealActionDto, isArray: true })
	actions: AbuseAppealActionDto[];

	@ApiProperty({ description: 'Whether an appeal can be filed now' })
	appealable: boolean;

	@ApiProperty({
		description:
			'Whether the appeal must include a DMCA counter-notice (17 USC 512(g)(3))',
	})
	counterNoticeRequired: boolean;

	@ApiProperty(NULLABLE_TIMESTAMP)
	appealedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	resolvedAt: string | null;
}
