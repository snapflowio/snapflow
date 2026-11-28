/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { apiError } from '../../common/utils/error/api-error.util';
import { errorMessage } from '../../common/utils/error/error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { EmailService } from '../../infra/email/services/email.service';
import { User } from '../../user/entities/user.entity';
import {
	AbuseCaseAction,
	type AbuseReportDecision,
	AbuseReportErrorCode,
	AbuseReportStatus,
} from '../constants/abuse-report.constants';
import { AbuseCaseDto } from '../dto/abuse-case.dto';
import {
	AbuseCaseActionRecordDto,
	AbuseEvidenceDto,
	type AbuseReportDetailDto,
	AbuseReportDto,
	type AbuseReportListQueryDto,
} from '../dto/abuse-report.dto';
import { AbuseCase } from '../entities/abuse-case.entity';
import { AbuseCaseActionRecord } from '../entities/abuse-case-action.entity';
import { AbuseEvidence } from '../entities/abuse-evidence.entity';
import { AbuseReport } from '../entities/abuse-report.entity';
import {
	ReporterEmailStage,
	reporterDecisionCopy,
} from '../utils/abuse-reporter-copy.util';
import { AbuseCaseActionService } from './abuse-case-action.service';

@Injectable()
export class AbuseReportReviewService {
	private readonly logger = new Logger(AbuseReportReviewService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly actions: AbuseCaseActionService,
		private readonly email: EmailService
	) {}

	async list(
		query: AbuseReportListQueryDto,
		viewerId: string
	): Promise<CursorPage<AbuseReportDto>> {
		const restrictedAccess = await this.restrictedAccess(
			this.entityManager,
			viewerId
		);
		const page = await findCursorPage(this.entityManager, AbuseReport, {
			where: query.status ? { status: query.status } : {},
			orderBy: { dueAt: QueryOrder.ASC, id: QueryOrder.ASC },
			limit: query.limit,
			cursor: query.cursor,
		});
		return {
			...page,
			items: page.items.map((report) =>
				AbuseReportDto.from(report, restrictedAccess)
			),
		};
	}

	async detail(
		reportId: string,
		viewerId: string
	): Promise<AbuseReportDetailDto> {
		const manager = this.entityManager.fork();
		const [report, restrictedAccess] = await Promise.all([
			this.report(manager, reportId),
			this.restrictedAccess(manager, viewerId),
		]);
		if (!report.abuseCaseId) {
			return {
				report: AbuseReportDto.from(report, restrictedAccess),
				abuseCase: null,
				evidence: [],
				actions: [],
			};
		}
		const [abuseCase, evidence, actions] = await Promise.all([
			manager.findOne(AbuseCase, { id: report.abuseCaseId }),
			manager.find(
				AbuseEvidence,
				{ abuseCaseId: report.abuseCaseId },
				{ orderBy: { createdAt: QueryOrder.ASC } }
			),
			manager.find(
				AbuseCaseActionRecord,
				{ abuseCaseId: report.abuseCaseId },
				{ orderBy: { createdAt: QueryOrder.ASC } }
			),
		]);
		return {
			report: AbuseReportDto.from(report, restrictedAccess),
			abuseCase: abuseCase ? AbuseCaseDto.from(abuseCase) : null,
			evidence: evidence.map((item) =>
				AbuseEvidenceDto.from(item, restrictedAccess)
			),
			actions: actions.map(AbuseCaseActionRecordDto.from),
		};
	}

	async decide(
		reportId: string,
		decision: AbuseReportDecision,
		note: string | null,
		actorId: string
	): Promise<AbuseReportDto> {
		const report = await this.entityManager
			.fork()
			.transactional(async (manager) => {
				const found = await this.report(
					manager,
					reportId,
					LockMode.PESSIMISTIC_WRITE
				);
				found.status = decision;
				found.decidedAt = await databaseNow(manager);
				found.decidedBy = actorId;
				found.decisionNote = note;
				await manager.flush();
				return found;
			});
		if (decision === AbuseReportStatus.REFERRED && report.abuseCaseId) {
			await this.actions.apply(
				report.abuseCaseId,
				AbuseCaseAction.REFER,
				actorId,
				note
			);
		}
		await this.informReporter(report, decision);
		return AbuseReportDto.from(
			report,
			await this.restrictedAccess(this.entityManager, actorId)
		);
	}

	private async restrictedAccess(
		manager: EntityManager,
		userId: string
	): Promise<boolean> {
		const viewer = await manager.findOne(
			User,
			{ id: userId },
			{ fields: ['restrictedEvidenceAccess'] }
		);
		return viewer?.restrictedEvidenceAccess ?? false;
	}

	private async report(
		manager: EntityManager,
		reportId: string,
		lockMode?: LockMode
	): Promise<AbuseReport> {
		const report = await manager.findOne(
			AbuseReport,
			{ id: reportId },
			{ lockMode }
		);
		if (!report) {
			throw new NotFoundException(
				apiError(
					AbuseReportErrorCode.REPORT_NOT_FOUND,
					'The abuse report does not exist.'
				)
			);
		}
		return report;
	}

	private async informReporter(
		report: AbuseReport,
		decision: AbuseReportDecision
	): Promise<void> {
		if (!report.reporterEmail) return;
		try {
			await this.email.sendAbuseReportUpdate({
				reportId: report.id,
				stage: `${ReporterEmailStage.DECIDED}:${decision}`,
				recipient: report.reporterEmail,
				...reporterDecisionCopy(report, decision),
			});
		} catch (error) {
			this.logger.warn(
				`Could not tell the reporter about abuse report ${report.id}: ${errorMessage(error)}`
			);
		}
	}
}
