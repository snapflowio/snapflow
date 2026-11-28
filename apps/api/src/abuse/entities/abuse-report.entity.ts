/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	booleanColumn,
	createdAtColumn,
	jsonColumn,
	textColumn,
	timestampColumn,
	updatedAtColumn,
	uuidColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../../infra/database/utils/entity-columns.util';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { User } from '../../user/entities/user.entity';
import {
	AbuseReportCategory,
	AbuseReporterType,
	AbuseReportStatus,
} from '../constants/abuse-report.constants';
import { IspComplaintOutcome } from '../constants/isp-complaint.constants';
import type {
	DmcaCounterNoticeDto,
	DmcaNoticeDto,
	IspComplaintDetailsDto,
} from '../dto/abuse-report-intake.dto';
import { AbuseCase } from './abuse-case.entity';

@Entity({ tableName: 'abuse_report' })
@Index({
	name: 'IDX_abuse_report_status_due',
	properties: ['status', 'dueAt'],
})
@Index({ name: 'IDX_abuse_report_case', properties: ['abuseCaseId'] })
@Index({
	name: 'IDX_abuse_report_restore_after',
	properties: ['restoreAfter'],
	options: { where: '"restoreAfter" is not null and "restoredAt" is null' },
})
@Check({
	name: 'CHK_abuse_report_reporter_type',
	expression: `"reporterType" in (${sqlValueList(AbuseReporterType)})`,
})
@Check({
	name: 'CHK_abuse_report_category',
	expression: `"category" in (${sqlValueList(AbuseReportCategory)})`,
})
@Check({
	name: 'CHK_abuse_report_isp_outcome',
	expression: `"ispOutcome" is null or "ispOutcome" in (${sqlValueList(IspComplaintOutcome)})`,
})
@Check({
	name: 'CHK_abuse_report_status',
	expression: `"status" in (${sqlValueList(AbuseReportStatus)})`,
})
export class AbuseReport {
	[OptionalProps]?:
		| 'id'
		| 'createdAt'
		| 'updatedAt'
		| 'status'
		| 'restricted'
		| 'abuseCaseId'
		| 'sandboxId'
		| 'organizationId'
		| 'machineId'
		| 'acknowledgedAt'
		| 'decidedAt'
		| 'decidedBy'
		| 'decisionNote'
		| 'appealText'
		| 'appealedAt'
		| 'counterNotice'
		| 'counterNoticeReceivedAt'
		| 'counterNoticeForwardedAt'
		| 'restoreAfter'
		| 'restoreBy'
		| 'courtActionFiledAt'
		| 'restoredAt'
		| 'ispOutcome';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(varcharColumn('reporterType'))
	reporterType: AbuseReporterType;

	@Property(varcharColumn('category'))
	category: AbuseReportCategory;

	@Property(varcharColumn('status'))
	status: AbuseReportStatus = AbuseReportStatus.RECEIVED;

	@Property({ ...textColumn('url'), nullable: true })
	url: string | null;

	@Property({ ...varcharColumn('hostname'), nullable: true })
	hostname: string | null;

	@Property(textColumn('description'))
	description: string;

	@Property({ ...varcharColumn('reporterName'), nullable: true })
	reporterName: string | null;

	@Property({ ...varcharColumn('reporterEmail'), nullable: true })
	reporterEmail: string | null;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'reporterUserId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_report_reporter_user',
	})
	reporterUserId: string | null;

	@Property({ ...uuidColumn('reporterOrganizationId'), nullable: true })
	reporterOrganizationId: string | null;

	@Property({ ...jsonColumn('dmca'), nullable: true })
	dmca: DmcaNoticeDto | null;

	@Property({ ...jsonColumn('ispComplaint'), nullable: true })
	ispComplaint: IspComplaintDetailsDto | null;

	@Property({ ...varcharColumn('ispOutcome'), nullable: true })
	ispOutcome: IspComplaintOutcome | null = null;

	@Property(booleanColumn('restricted'))
	restricted = false;

	@ManyToOne({
		entity: () => AbuseCase,
		mapToPk: true,
		joinColumn: 'abuseCaseId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_report_case',
	})
	abuseCaseId: string | null = null;

	@Property({ ...varcharColumn('sandboxId'), nullable: true })
	sandboxId: string | null = null;

	@Property({ ...uuidColumn('organizationId'), nullable: true })
	organizationId: string | null = null;

	@Property({ ...uuidColumn('machineId'), nullable: true })
	machineId: string | null = null;

	@Property(timestampColumn('dueAt'))
	dueAt: Date;

	@Property({ ...timestampColumn('acknowledgedAt'), nullable: true })
	acknowledgedAt: Date | null = null;

	@Property({ ...timestampColumn('decidedAt'), nullable: true })
	decidedAt: Date | null = null;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'decidedBy',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_report_decided_by',
	})
	decidedBy: string | null = null;

	@Property({ ...textColumn('decisionNote'), nullable: true })
	decisionNote: string | null = null;

	@Property({ ...textColumn('appealText'), nullable: true })
	appealText: string | null = null;

	@Property({ ...timestampColumn('appealedAt'), nullable: true })
	appealedAt: Date | null = null;

	@Property({ ...jsonColumn('counterNotice'), nullable: true })
	counterNotice: DmcaCounterNoticeDto | null = null;

	@Property({ ...timestampColumn('counterNoticeReceivedAt'), nullable: true })
	counterNoticeReceivedAt: Date | null = null;

	@Property({ ...timestampColumn('counterNoticeForwardedAt'), nullable: true })
	counterNoticeForwardedAt: Date | null = null;

	@Property({ ...timestampColumn('restoreAfter'), nullable: true })
	restoreAfter: Date | null = null;

	@Property({ ...timestampColumn('restoreBy'), nullable: true })
	restoreBy: Date | null = null;

	@Property({ ...timestampColumn('courtActionFiledAt'), nullable: true })
	courtActionFiledAt: Date | null = null;

	@Property({ ...timestampColumn('restoredAt'), nullable: true })
	restoredAt: Date | null = null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}
