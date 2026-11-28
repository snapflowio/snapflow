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
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import {
	ABUSE_INTAKE_LIMITS,
	ABUSE_REPORT_DECISIONS,
	AbuseCaseAction,
	AbuseEvidenceKind,
	AbuseReportCategory,
	type AbuseReportDecision,
	AbuseReporterType,
	AbuseReportStatus,
	DMCA_RESTORATION,
} from '../constants/abuse-report.constants';
import { IspComplaintOutcome } from '../constants/isp-complaint.constants';
import type { AbuseCaseActionRecord } from '../entities/abuse-case-action.entity';
import type { AbuseEvidence } from '../entities/abuse-evidence.entity';
import type { AbuseReport } from '../entities/abuse-report.entity';
import {
	counterNoticeForwardDueAt,
	counterNoticeForwardedLate,
} from '../utils/dmca-restoration.util';
import { AbuseCaseDto } from './abuse-case.dto';
import {
	DmcaCounterNoticeDto,
	DmcaNoticeDto,
	IspComplaintDetailsDto,
} from './abuse-report-intake.dto';

const NULLABLE_TIMESTAMP = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

const NULLABLE_STRING = { type: String, nullable: true } as const;

@ApiSchema({ name: 'AbuseReport' })
export class AbuseReportDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ enum: AbuseReporterType, enumName: 'AbuseReporterType' })
	reporterType: AbuseReporterType;

	@ApiProperty({ enum: AbuseReportCategory, enumName: 'AbuseReportCategory' })
	category: AbuseReportCategory;

	@ApiProperty({ enum: AbuseReportStatus, enumName: 'AbuseReportStatus' })
	status: AbuseReportStatus;

	@ApiProperty(NULLABLE_STRING)
	url: string | null;

	@ApiProperty(NULLABLE_STRING)
	hostname: string | null;

	@ApiProperty(NULLABLE_STRING)
	description: string | null;

	@ApiProperty(NULLABLE_STRING)
	reporterName: string | null;

	@ApiProperty(NULLABLE_STRING)
	reporterEmail: string | null;

	@ApiProperty({ type: DmcaNoticeDto, nullable: true })
	dmca: DmcaNoticeDto | null;

	@ApiProperty({ type: IspComplaintDetailsDto, nullable: true })
	ispComplaint: IspComplaintDetailsDto | null;

	@ApiProperty({
		enum: IspComplaintOutcome,
		enumName: 'IspComplaintOutcome',
		nullable: true,
	})
	ispOutcome: IspComplaintOutcome | null;

	@ApiProperty({ description: 'CSAM-related; evidence is access-restricted' })
	restricted: boolean;

	@ApiProperty({
		description:
			'The report is restricted and its URL, hostname, description and appeal are withheld from this viewer',
	})
	withheld: boolean;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	abuseCaseId: string | null;

	@ApiProperty(NULLABLE_STRING)
	sandboxId: string | null;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	organizationId: string | null;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	machineId: string | null;

	@ApiProperty({ type: String, format: 'date-time' })
	dueAt: string;

	@ApiProperty(NULLABLE_TIMESTAMP)
	acknowledgedAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	decidedAt: string | null;

	@ApiProperty(NULLABLE_STRING)
	decisionNote: string | null;

	@ApiProperty(NULLABLE_STRING)
	appealText: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	appealedAt: string | null;

	@ApiProperty({ type: DmcaCounterNoticeDto, nullable: true })
	counterNotice: DmcaCounterNoticeDto | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	counterNoticeReceivedAt: string | null;

	@ApiProperty({
		...NULLABLE_TIMESTAMP,
		description:
			'When the complainant was sent a copy of the counter-notice (17 USC 512(g)(2)(B)); restoration is scheduled from it',
	})
	counterNoticeForwardedAt: string | null;

	@ApiProperty({
		...NULLABLE_TIMESTAMP,
		description: `When the complainant copy is due, ${DMCA_RESTORATION.forwardWithinBusinessDays} business day after the counter-notice`,
	})
	counterNoticeForwardDueAt: string | null;

	@ApiProperty({
		description: `Whether the complainant copy went out so late that restoration falls after ${DMCA_RESTORATION.maximumBusinessDays} business days from the counter-notice`,
	})
	counterNoticeForwardedLate: boolean;

	@ApiProperty({
		...NULLABLE_TIMESTAMP,
		description: `Earliest restoration time, ${DMCA_RESTORATION.minimumBusinessDays} business days after both the counter-notice and the complainant copy (17 USC 512(g)(2)(C)); null until the copy is sent`,
	})
	restoreAfter: string | null;

	@ApiProperty({
		...NULLABLE_TIMESTAMP,
		description: `Latest restoration time, ${DMCA_RESTORATION.maximumBusinessDays} business days after the counter-notice, or the same window width after restoreAfter when the copy went out late; null until the copy is sent`,
	})
	restoreBy: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	courtActionFiledAt: string | null;

	@ApiProperty(NULLABLE_TIMESTAMP)
	restoredAt: string | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: string;

	static from(report: AbuseReport, restrictedAccess = false): AbuseReportDto {
		const withheld = report.restricted && !restrictedAccess;
		return {
			id: report.id,
			reporterType: report.reporterType,
			category: report.category,
			status: report.status,
			url: withheld ? null : report.url,
			hostname: withheld ? null : report.hostname,
			description: withheld ? null : report.description,
			reporterName: report.reporterName,
			reporterEmail: report.reporterEmail,
			dmca: report.dmca,
			ispComplaint: report.ispComplaint,
			ispOutcome: report.ispOutcome,
			restricted: report.restricted,
			withheld,
			abuseCaseId: report.abuseCaseId,
			sandboxId: report.sandboxId,
			organizationId: report.organizationId,
			machineId: report.machineId,
			dueAt: report.dueAt.toISOString(),
			acknowledgedAt: report.acknowledgedAt?.toISOString() ?? null,
			decidedAt: report.decidedAt?.toISOString() ?? null,
			decisionNote: report.decisionNote,
			appealText: withheld ? null : report.appealText,
			appealedAt: report.appealedAt?.toISOString() ?? null,
			counterNotice: report.counterNotice,
			counterNoticeReceivedAt:
				report.counterNoticeReceivedAt?.toISOString() ?? null,
			counterNoticeForwardedAt:
				report.counterNoticeForwardedAt?.toISOString() ?? null,
			counterNoticeForwardDueAt: report.counterNoticeReceivedAt
				? counterNoticeForwardDueAt(
						report.counterNoticeReceivedAt
					).toISOString()
				: null,
			counterNoticeForwardedLate: counterNoticeForwardedLate(report),
			restoreAfter: report.restoreAfter?.toISOString() ?? null,
			restoreBy: report.restoreBy?.toISOString() ?? null,
			courtActionFiledAt: report.courtActionFiledAt?.toISOString() ?? null,
			restoredAt: report.restoredAt?.toISOString() ?? null,
			createdAt: report.createdAt.toISOString(),
		};
	}
}

@ApiSchema({ name: 'IspComplaint' })
export class IspComplaintDto extends PickType(AbuseReportDto, [
	'id',
	'status',
	'description',
	'ispComplaint',
	'ispOutcome',
	'createdAt',
] as const) {
	static from(report: AbuseReport): IspComplaintDto {
		const { id, status, description, ispComplaint, ispOutcome, createdAt } =
			AbuseReportDto.from(report);
		return { id, status, description, ispComplaint, ispOutcome, createdAt };
	}
}

@ApiSchema({ name: 'AbuseEvidence' })
export class AbuseEvidenceDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ enum: AbuseEvidenceKind, enumName: 'AbuseEvidenceKind' })
	kind: AbuseEvidenceKind;

	@ApiProperty()
	restricted: boolean;

	@ApiProperty({
		type: 'object',
		additionalProperties: true,
		nullable: true,
		description:
			'The preserved record; null when it is restricted and the viewer lacks restricted-evidence access',
	})
	payload: AbuseEvidence['payload'] | null;

	@ApiProperty({
		description:
			'The record is restricted and withheld from this viewer, who can see only that it exists',
	})
	withheld: boolean;

	@ApiProperty({ type: String, format: 'date-time' })
	retainUntil: string;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: string;

	static from(
		evidence: AbuseEvidence,
		restrictedAccess: boolean
	): AbuseEvidenceDto {
		const withheld = evidence.restricted && !restrictedAccess;
		return {
			id: evidence.id,
			kind: evidence.kind,
			restricted: evidence.restricted,
			payload: withheld ? null : evidence.payload,
			withheld,
			retainUntil: evidence.retainUntil.toISOString(),
			createdAt: evidence.createdAt.toISOString(),
		};
	}
}

@ApiSchema({ name: 'AbuseCaseActionRecord' })
export class AbuseCaseActionRecordDto {
	@ApiProperty({ enum: AbuseCaseAction, enumName: 'AbuseCaseAction' })
	action: AbuseCaseAction;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	actorId: string | null;

	@ApiProperty(NULLABLE_STRING)
	note: string | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: string;

	static from(record: AbuseCaseActionRecord): AbuseCaseActionRecordDto {
		return {
			action: record.action,
			actorId: record.actorId,
			note: record.note,
			createdAt: record.createdAt.toISOString(),
		};
	}
}

@ApiSchema({ name: 'AbuseReportDetail' })
export class AbuseReportDetailDto {
	@ApiProperty({ type: AbuseReportDto })
	report: AbuseReportDto;

	@ApiProperty({ type: AbuseCaseDto, nullable: true })
	abuseCase: AbuseCaseDto | null;

	@ApiProperty({ type: [AbuseEvidenceDto] })
	evidence: AbuseEvidenceDto[];

	@ApiProperty({ type: [AbuseCaseActionRecordDto] })
	actions: AbuseCaseActionRecordDto[];
}

@ApiSchema({ name: 'AbuseReportPage' })
export class AbuseReportPageDto extends CursorPageDto<AbuseReportDto> {
	@ApiProperty({ type: [AbuseReportDto] })
	declare items: AbuseReportDto[];
}

@ApiSchema({ name: 'AbuseReportListQuery' })
export class AbuseReportListQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		enum: AbuseReportStatus,
		enumName: 'AbuseReportStatus',
		description: 'Only reports in this status',
	})
	@IsOptional()
	@IsEnum(AbuseReportStatus)
	status?: AbuseReportStatus;
}

@ApiSchema({ name: 'DecideAbuseReport' })
export class DecideAbuseReportDto {
	@ApiProperty({ enum: ABUSE_REPORT_DECISIONS })
	@IsIn(ABUSE_REPORT_DECISIONS)
	decision: AbuseReportDecision;

	@ApiPropertyOptional({ description: 'Internal note on the decision' })
	@IsOptional()
	@IsString()
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	note?: string;
}

@ApiSchema({ name: 'ApplyAbuseCaseAction' })
export class ApplyAbuseCaseActionDto {
	@ApiProperty({ enum: AbuseCaseAction, enumName: 'AbuseCaseAction' })
	@IsEnum(AbuseCaseAction)
	action: AbuseCaseAction;

	@ApiPropertyOptional({ description: 'Why the step is taken' })
	@IsOptional()
	@IsString()
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	note?: string;
}
