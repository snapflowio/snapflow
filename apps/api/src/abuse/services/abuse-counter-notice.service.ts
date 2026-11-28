/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, RequestContext } from '@mikro-orm/core';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { errorMessage } from '../../common/utils/error/error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { AbuseCaseStatus } from '../constants/abuse.constants';
import {
	AbuseReportCategory,
	AbuseReportErrorCode,
	AbuseReportStatus,
	DMCA_RESTORATION_JOB,
	SETTLED_REPORT_STATUSES,
} from '../constants/abuse-report.constants';
import { AbuseReportDto } from '../dto/abuse-report.dto';
import { AbuseCase } from '../entities/abuse-case.entity';
import { AbuseReport } from '../entities/abuse-report.entity';
import { restorableCounterNoticeCases } from '../queries/counter-notice.query';
import { forwardedCounterNotice } from '../utils/dmca-restoration.util';
import { AbuseCaseActionService } from './abuse-case-action.service';

const SETTLED_STATUS_SET: ReadonlySet<AbuseReportStatus> = new Set(
	SETTLED_REPORT_STATUSES
);

const AUTOMATED_RESTRICTION_STATUSES: ReadonlySet<AbuseCaseStatus> = new Set([
	AbuseCaseStatus.THROTTLED,
	AbuseCaseStatus.SUSPENDED,
]);

function restorable(report: AbuseReport, now: Date): boolean {
	return (
		report.category === AbuseReportCategory.COPYRIGHT &&
		report.restoreAfter !== null &&
		report.restoreAfter <= now &&
		report.restoredAt === null &&
		report.courtActionFiledAt === null
	);
}

function hasOtherBasis(abuseCase: AbuseCase): boolean {
	return (
		AUTOMATED_RESTRICTION_STATUSES.has(abuseCase.status) ||
		Object.keys(abuseCase.findings).length > 0 ||
		[
			abuseCase.egressBlockedAt,
			abuseCase.pausedAt,
			abuseCase.terminatedAt,
			abuseCase.organizationSuspendedAt,
			abuseCase.referredAt,
		].some((actionedAt) => actionedAt !== null)
	);
}

@Injectable()
export class AbuseCounterNoticeService {
	private readonly logger = new Logger(AbuseCounterNoticeService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly orm: MikroORM,
		private readonly locks: RedisLockProvider,
		private readonly actions: AbuseCaseActionService
	) {}

	recordCourtAction(reportId: string): Promise<AbuseReportDto> {
		return this.updateUnrestored(
			reportId,
			AbuseReportErrorCode.COURT_ACTION_INVALID,
			'Court action can only be recorded on a counter-noticed report whose material has not been restored yet.',
			() => true,
			(report, now) => {
				report.courtActionFiledAt ??= now;
			}
		);
	}

	recordCounterNoticeForwarded(reportId: string): Promise<AbuseReportDto> {
		return this.updateUnrestored(
			reportId,
			AbuseReportErrorCode.COUNTER_NOTICE_FORWARD_INVALID,
			'Forwarding can only be recorded once, on a counter-noticed report whose material has not been restored yet.',
			(report) => report.counterNoticeForwardedAt === null,
			(report, now, receivedAt) => {
				Object.assign(report, forwardedCounterNotice(receivedAt, now));
			}
		);
	}

	restoreDue(): Promise<void> {
		return this.locks.runExclusive(
			DMCA_RESTORATION_JOB.lockKey,
			DMCA_RESTORATION_JOB.lockTtlSeconds,
			() =>
				RequestContext.create(this.orm.em, async () => {
					const caseIds = await restorableCounterNoticeCases(
						this.entityManager.fork(),
						DMCA_RESTORATION_JOB.batchSize
					);
					for (const caseId of caseIds) {
						await this.restore(caseId).catch((error: unknown) =>
							this.logger.error(
								`Could not restore counter-noticed material of abuse case ${caseId}: ${errorMessage(error)}`
							)
						);
					}
				})
		);
	}

	private async updateUnrestored(
		reportId: string,
		errorCode: AbuseReportErrorCode,
		message: string,
		allowed: (report: AbuseReport) => boolean,
		update: (report: AbuseReport, now: Date, receivedAt: Date) => void
	): Promise<AbuseReportDto> {
		return this.entityManager.fork().transactional(async (manager) => {
			const report = await manager.findOne(
				AbuseReport,
				{ id: reportId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!report) {
				throw new NotFoundException(
					apiError(
						AbuseReportErrorCode.REPORT_NOT_FOUND,
						'The abuse report does not exist.'
					)
				);
			}
			if (
				!report.counterNoticeReceivedAt ||
				report.restoredAt ||
				!allowed(report)
			) {
				throw new ConflictException(apiError(errorCode, message));
			}
			update(
				report,
				await databaseNow(manager),
				report.counterNoticeReceivedAt
			);
			await manager.flush();
			return AbuseReportDto.from(report);
		});
	}

	private async restore(caseId: string): Promise<void> {
		const previewLifted = await this.entityManager
			.fork()
			.transactional(async (manager) => {
				const reports = await manager.find(
					AbuseReport,
					{ abuseCaseId: caseId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const abuseCase = await manager.findOneOrFail(AbuseCase, {
					id: caseId,
				});
				const now = await databaseNow(manager);
				const due = reports.filter((report) => restorable(report, now));
				const blocked = reports.some(
					(report) =>
						!due.includes(report) && !SETTLED_STATUS_SET.has(report.status)
				);
				if (due.length === 0 || blocked) return null;
				let lifted: string | null = null;
				if (abuseCase.status !== AbuseCaseStatus.RESOLVED) {
					if (hasOtherBasis(abuseCase)) {
						lifted = abuseCase.previewDisabledAt ? abuseCase.sandboxId : null;
						abuseCase.previewDisabledAt = null;
					} else {
						await this.actions.resolve(caseId, null);
					}
				}
				for (const report of due) {
					report.restoredAt = now;
					report.status = AbuseReportStatus.CLOSED;
				}
				await manager.flush();
				return lifted;
			});
		if (previewLifted) {
			await this.actions.refreshEdges(previewLifted);
		}
	}
}
