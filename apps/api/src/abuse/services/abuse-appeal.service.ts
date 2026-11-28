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
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { OnAsyncEvent } from '../../common/decorators/on-async-event.decorator';
import { apiError } from '../../common/utils/error/api-error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { EmailService } from '../../infra/email/services/email.service';
import { AbuseNoticeEvents } from '../../notification/constants/notice.constants';
import { CounterNoticeForwardEvent } from '../../notification/events/counter-notice-forward.event';
import { enqueueCounterNoticeForward } from '../../notification/utils/notice-outbox.util';
import { AbuseCaseStatus, AbuseErrorCode } from '../constants/abuse.constants';
import {
	AbuseReportCategory,
	AbuseReportErrorCode,
	AbuseReportStatus,
	APPEALABLE_REPORT_STATUSES,
} from '../constants/abuse-report.constants';
import {
	AbuseAppealActionDto,
	type AbuseAppealDto,
} from '../dto/abuse-appeal.dto';
import type { AppealAbuseDecisionDto } from '../dto/abuse-report-intake.dto';
import { AbuseCase } from '../entities/abuse-case.entity';
import { AbuseCaseActionRecord } from '../entities/abuse-case-action.entity';
import { AbuseReport } from '../entities/abuse-report.entity';
import {
	ReporterEmailStage,
	reporterCounterNoticeCopy,
} from '../utils/abuse-reporter-copy.util';
import { forwardedCounterNotice } from '../utils/dmca-restoration.util';

const APPEALABLE_STATUS_SET: ReadonlySet<AbuseReportStatus> = new Set(
	APPEALABLE_REPORT_STATUSES
);

function canAppeal(abuseCase: AbuseCase, reports: readonly AbuseReport[]) {
	return (
		abuseCase.manual &&
		abuseCase.status !== AbuseCaseStatus.RESOLVED &&
		reports.some((report) => APPEALABLE_STATUS_SET.has(report.status))
	);
}

function isCopyright(report: AbuseReport): boolean {
	return report.category === AbuseReportCategory.COPYRIGHT;
}

function latestAppeal(reports: readonly AbuseReport[]): Date | null {
	return reports.reduce<Date | null>(
		(latest, { appealedAt }) =>
			appealedAt && (!latest || appealedAt > latest) ? appealedAt : latest,
		null
	);
}

@Injectable()
export class AbuseAppealService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly email: EmailService
	) {}

	async summary(
		caseId: string,
		organizationId: string
	): Promise<AbuseAppealDto> {
		const manager = this.entityManager.fork();
		const abuseCase = await this.organizationCase(
			manager,
			caseId,
			organizationId
		);
		const [reports, actions] = await Promise.all([
			manager.find(AbuseReport, { abuseCaseId: caseId }),
			manager.find(
				AbuseCaseActionRecord,
				{ abuseCaseId: caseId },
				{ orderBy: { createdAt: QueryOrder.ASC } }
			),
		]);
		return {
			caseId: abuseCase.id,
			sandboxId: abuseCase.sandboxId,
			categories: [...new Set(reports.map((report) => report.category))],
			actions: actions.map(AbuseAppealActionDto.from),
			appealable: canAppeal(abuseCase, reports),
			counterNoticeRequired: reports.some(isCopyright),
			appealedAt: latestAppeal(reports)?.toISOString() ?? null,
			resolvedAt: abuseCase.resolvedAt?.toISOString() ?? null,
		};
	}

	async appeal(
		caseId: string,
		organizationId: string,
		{ appeal, counterNotice }: AppealAbuseDecisionDto
	): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			const abuseCase = await this.organizationCase(
				manager,
				caseId,
				organizationId
			);
			const reports = await manager.find(
				AbuseReport,
				{ abuseCaseId: caseId, status: { $in: APPEALABLE_REPORT_STATUSES } },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!canAppeal(abuseCase, reports)) {
				throw new ConflictException(
					apiError(
						AbuseReportErrorCode.APPEAL_NOT_ALLOWED,
						'This case cannot be appealed. Contact support if you need help.'
					)
				);
			}
			if (!counterNotice && reports.some(isCopyright)) {
				throw new BadRequestException(
					apiError(
						AbuseReportErrorCode.COUNTER_NOTICE_REQUIRED,
						'Copyright takedowns can only be appealed with a complete DMCA counter-notice.'
					)
				);
			}
			const now = await databaseNow(manager);
			for (const report of reports) {
				report.status = AbuseReportStatus.APPEALED;
				report.appealText = appeal;
				report.appealedAt = now;
				if (isCopyright(report) && counterNotice) {
					report.counterNotice = counterNotice;
					report.counterNoticeReceivedAt = now;
					if (report.reporterEmail) {
						await enqueueCounterNoticeForward(
							manager,
							new CounterNoticeForwardEvent(abuseCase.organizationId, report.id)
						);
					}
				}
			}
			await manager.flush();
		});
	}

	@OnAsyncEvent({ event: AbuseNoticeEvents.FORWARD_COUNTER_NOTICE })
	@IsolatedEntityManagerContext()
	async forwardCounterNotice({
		reportId,
	}: CounterNoticeForwardEvent): Promise<void> {
		const report = await this.entityManager.findOne(AbuseReport, {
			id: reportId,
		});
		if (
			!report?.reporterEmail ||
			!report.counterNotice ||
			!report.counterNoticeReceivedAt ||
			report.counterNoticeForwardedAt
		) {
			return;
		}
		const forwarded = forwardedCounterNotice(
			report.counterNoticeReceivedAt,
			await databaseNow(this.entityManager)
		);
		await this.email.sendAbuseReportUpdate({
			reportId: report.id,
			stage: `${ReporterEmailStage.COUNTER_NOTICE}:${forwarded.restoreAfter.getTime()}`,
			recipient: report.reporterEmail,
			...reporterCounterNoticeCopy(
				report,
				report.counterNotice,
				forwarded.restoreAfter
			),
		});
		await this.entityManager.nativeUpdate(
			AbuseReport,
			{ id: report.id, counterNoticeForwardedAt: null },
			forwarded
		);
	}

	private async organizationCase(
		manager: EntityManager,
		caseId: string,
		organizationId: string
	): Promise<AbuseCase> {
		const abuseCase = await manager.findOne(AbuseCase, {
			id: caseId,
			organizationId,
		});
		if (!abuseCase) {
			throw new NotFoundException(
				apiError(
					AbuseErrorCode.CASE_NOT_FOUND,
					'The abuse case does not exist.'
				)
			);
		}
		return abuseCase;
	}
}
