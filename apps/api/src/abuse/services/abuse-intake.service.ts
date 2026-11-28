/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
} from '@nestjs/common';
import { ABUSE_REPORT_VERIFICATION_ACTION } from '../../auth/constants/human-verification.constants';
import { HumanVerificationService } from '../../auth/services/human-verification.service';
import { SECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { apiError } from '../../common/utils/error/api-error.util';
import { errorMessage } from '../../common/utils/error/error.util';
import { addSeconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { EmailService } from '../../infra/email/services/email.service';
import { User } from '../../user/entities/user.entity';
import {
	ABUSE_REPORT_MATCH_LOOKBACK_SECONDS,
	ABUSE_RESPONSE_TARGET_HOURS,
	AbuseCaseAction,
	AbuseReportCategory,
	AbuseReportErrorCode,
	AbuseReporterType,
	AbuseReportStatus,
	ANONYMOUS_REPORT_CATEGORIES,
	AUTOMATIC_TAKEDOWN_NOTE,
	IMMEDIATE_TAKEDOWN_CATEGORIES,
	RESTRICTED_REPORT_CATEGORIES,
} from '../constants/abuse-report.constants';
import type {
	AbuseReportReceiptDto,
	CreateAbuseReportDto,
	CreateSignedInAbuseReportDto,
} from '../dto/abuse-report-intake.dto';
import { AbuseReport } from '../entities/abuse-report.entity';
import {
	type HostnameOwner,
	hostnameOwner,
} from '../queries/abuse-hostname.query';
import {
	capturableReportUrl,
	reportedHostnames,
} from '../utils/abuse-report-url.util';
import {
	ReporterEmailStage,
	reporterAcknowledgementCopy,
} from '../utils/abuse-reporter-copy.util';
import { AbuseCaseActionService } from './abuse-case-action.service';
import { AbuseEvidenceService } from './abuse-evidence.service';

type Reporter = Pick<
	AbuseReport,
	'reporterType' | 'reporterUserId' | 'reporterOrganizationId'
>;

type ReportInput = Omit<CreateAbuseReportDto, 'humanVerificationToken'>;

type MatchedReport = {
	report: AbuseReport;
	owner: HostnameOwner | null;
};

@Injectable()
export class AbuseIntakeService {
	private readonly logger = new Logger(AbuseIntakeService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly humanVerification: HumanVerificationService,
		private readonly actions: AbuseCaseActionService,
		private readonly evidence: AbuseEvidenceService,
		private readonly email: EmailService
	) {}

	async submit(
		dto: CreateAbuseReportDto,
		clientIp: string | undefined
	): Promise<AbuseReportReceiptDto> {
		assertComplete(dto);
		const verified = await this.humanVerification.verify(
			dto.humanVerificationToken,
			clientIp,
			ABUSE_REPORT_VERIFICATION_ACTION
		);
		if (!verified) {
			throw new ForbiddenException(
				apiError(
					AbuseReportErrorCode.HUMAN_VERIFICATION_FAILED,
					'The human verification check failed. Reload the page and try again.'
				)
			);
		}
		return this.intake(dto, {
			reporterType: AbuseReporterType.PUBLIC,
			reporterUserId: null,
			reporterOrganizationId: null,
		});
	}

	async submitSignedIn(
		dto: CreateSignedInAbuseReportDto,
		userId: string,
		organizationId: string
	): Promise<AbuseReportReceiptDto> {
		const user = await this.entityManager
			.fork()
			.findOneOrFail(User, { id: userId }, { fields: ['name', 'email'] });
		const report = {
			...dto,
			reporterName: user.name.trim() || user.email,
			reporterEmail: user.email,
		};
		assertComplete(report);
		return this.intake(report, {
			reporterType: AbuseReporterType.USER,
			reporterUserId: userId,
			reporterOrganizationId: organizationId,
		});
	}

	private async intake(
		dto: ReportInput,
		reporter: Reporter
	): Promise<AbuseReportReceiptDto> {
		const { report, owner } = await this.entityManager
			.fork()
			.transactional((manager) => this.record(manager, dto, reporter));
		if (report.abuseCaseId && owner) {
			await this.secure(report, report.abuseCaseId, owner);
		}
		await this.acknowledge(report);
		return { id: report.id, respondBy: report.dueAt };
	}

	private async record(
		manager: EntityManager,
		dto: ReportInput,
		reporter: Reporter
	): Promise<MatchedReport> {
		const now = await databaseNow(manager);
		const owner = await this.owner(manager, dto.url, now);
		const report = manager.create(AbuseReport, {
			...reporter,
			category: dto.category,
			url: dto.url,
			hostname: new URL(dto.url).host.toLowerCase(),
			description: dto.description,
			reporterName: dto.reporterName ?? null,
			reporterEmail: dto.reporterEmail ?? null,
			dmca: dto.dmca ?? null,
			ispComplaint: null,
			restricted: RESTRICTED_REPORT_CATEGORIES.has(dto.category),
			status: owner ? AbuseReportStatus.MATCHED : AbuseReportStatus.UNMATCHED,
			acknowledgedAt: now,
			dueAt: addSeconds(
				now,
				ABUSE_RESPONSE_TARGET_HOURS[dto.category] * SECONDS_PER_HOUR
			),
		});
		if (owner) {
			const abuseCase = await this.actions.openForReport(
				manager,
				owner,
				dto.category,
				now
			);
			report.abuseCaseId = abuseCase.id;
			report.sandboxId = owner.sandboxId;
			report.organizationId = owner.organizationId;
			report.machineId = owner.machineId;
		}
		await manager.flush();
		return { report, owner };
	}

	private async owner(
		manager: EntityManager,
		url: string,
		now: Date
	): Promise<HostnameOwner | null> {
		const window = {
			from: addSeconds(now, -ABUSE_REPORT_MATCH_LOOKBACK_SECONDS),
			until: now,
		};
		for (const hostname of reportedHostnames(url)) {
			const owner = await hostnameOwner(manager, hostname, window);
			if (owner) return owner;
		}
		return null;
	}

	private async secure(
		report: AbuseReport,
		caseId: string,
		owner: HostnameOwner
	): Promise<void> {
		await this.evidence.capture(caseId, owner.sandboxId, {
			previewUrl: report.url
				? capturableReportUrl(report.url, owner.kind)
				: null,
			restricted: report.restricted,
		});
		if (IMMEDIATE_TAKEDOWN_CATEGORIES.has(report.category)) {
			await this.actions.apply(
				caseId,
				AbuseCaseAction.DISABLE_PREVIEW,
				null,
				AUTOMATIC_TAKEDOWN_NOTE
			);
		}
	}

	private async acknowledge(report: AbuseReport): Promise<void> {
		if (!report.reporterEmail) return;
		try {
			await this.email.sendAbuseReportUpdate({
				reportId: report.id,
				stage: ReporterEmailStage.ACKNOWLEDGED,
				recipient: report.reporterEmail,
				...reporterAcknowledgementCopy(report),
			});
		} catch (error) {
			this.logger.warn(
				`Could not acknowledge abuse report ${report.id}: ${errorMessage(error)}`
			);
		}
	}
}

function assertComplete(dto: ReportInput): void {
	const anonymous = ANONYMOUS_REPORT_CATEGORIES.has(dto.category);
	if (!anonymous && (!dto.reporterName || !dto.reporterEmail)) {
		throw new BadRequestException(
			apiError(
				AbuseReportErrorCode.CONTACT_REQUIRED,
				'Add your name and email so we can follow up. Only CSAM and threat-to-life reports can be anonymous.'
			)
		);
	}
	if (dto.category === AbuseReportCategory.COPYRIGHT && !dto.dmca) {
		throw new BadRequestException(
			apiError(
				AbuseReportErrorCode.DMCA_INCOMPLETE,
				'Copyright reports need every element of a DMCA notice, including your signature.'
			)
		);
	}
}
