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
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { BillingReceiptErrorCode } from '../../billing/constants/billing-receipt.constants';
import {
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_HOUR,
} from '../../common/constants/time.constants';
import { apiError } from '../../common/utils/error/api-error.util';
import { addSeconds } from '../../common/utils/time.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineNotFoundException } from '../../machine/exceptions/machine-not-found.exception';
import {
	ABUSE_RESPONSE_TARGET_HOURS,
	AbuseReportCategory,
	AbuseReportErrorCode,
	AbuseReporterType,
	AbuseReportStatus,
	ISP_COMPLAINT_TARGET,
} from '../constants/abuse-report.constants';
import {
	CONNECTION_RECORDS,
	ConnectionWorkloadKind,
	ISP_COMPLAINT_LIST_LIMIT,
	ISP_COMPLAINT_MATCHING,
	IspComplaintOutcome,
	IspComplaintProtocol,
} from '../constants/isp-complaint.constants';
import { IspComplaintDto } from '../dto/abuse-report.dto';
import type { CreateIspComplaintDto } from '../dto/abuse-report-intake.dto';
import type { MachineConnectionReportDto } from '../dto/machine-connection-report.dto';
import { AbuseReport } from '../entities/abuse-report.entity';
import {
	connectionCoverage,
	recordConnectionCoverage,
} from '../queries/connection-coverage.query';
import {
	attributedWorkloads,
	organizationsBuildingOnMachine,
	sandboxesPlacedOnMachine,
	upsertConnectionRecords,
} from '../queries/connection-record.query';
import { machineAddressCovered } from '../queries/machine-public-address.query';
import { renderIspStatementPdf } from '../templates/isp-statement-document';
import { ispStatementContent } from '../utils/isp-statement.util';
import { AbuseCaseActionService } from './abuse-case-action.service';
import { AbuseEvidenceService } from './abuse-evidence.service';

const OUTCOME_STATUS = {
	[IspComplaintOutcome.NOT_SNAPFLOW]: AbuseReportStatus.UNMATCHED,
	[IspComplaintOutcome.ATTRIBUTED]: AbuseReportStatus.MATCHED,
	[IspComplaintOutcome.MANUAL_REVIEW]: AbuseReportStatus.IN_REVIEW,
	[IspComplaintOutcome.RECORDS_INCOMPLETE]: AbuseReportStatus.IN_REVIEW,
} as const satisfies Record<IspComplaintOutcome, AbuseReportStatus>;

const NO_MATCH = 0;
const SINGLE_MATCH = 1;

@Injectable()
export class IspComplaintService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly actions: AbuseCaseActionService,
		private readonly evidence: AbuseEvidenceService,
		private readonly config: TypedConfigService
	) {}

	async ingestConnections(
		machineId: string,
		report: MachineConnectionReportDto
	): Promise<void> {
		const window = reportWindow(report);
		await this.entityManager.fork().transactional(async (manager) => {
			const sandboxes = await sandboxesPlacedOnMachine(
				manager,
				machineId,
				report.sandboxes.map(({ sandboxId }) => sandboxId),
				window
			);
			const sandboxOrganizations = new Map(
				sandboxes.map((sandbox) => [sandbox.id, sandbox.organizationId])
			);
			const buildingOrganizations = await organizationsBuildingOnMachine(
				manager,
				machineId,
				report.builders.map(({ organizationId }) => organizationId),
				window
			);
			const workloads = [
				...report.sandboxes.map(({ sandboxId, ...connections }) => ({
					...connections,
					workloadId: sandboxId,
					workloadKind: ConnectionWorkloadKind.SANDBOX,
					organizationId: sandboxOrganizations.get(sandboxId),
				})),
				...report.builders.map(
					({ builderId, organizationId, ...connections }) => ({
						...connections,
						workloadId: builderId,
						workloadKind: ConnectionWorkloadKind.BUILDER,
						organizationId: buildingOrganizations.has(organizationId)
							? organizationId
							: undefined,
					})
				),
			];
			const rows = workloads.flatMap(
				({ flows, workloadId, workloadKind, organizationId }) =>
					organizationId
						? flows.map((flow) => ({
								...flow,
								workloadId,
								workloadKind,
								organizationId,
								machineId,
							}))
						: []
			);
			await upsertConnectionRecords(manager, rows);
			await recordConnectionCoverage(manager, machineId, {
				...window,
				complete:
					report.complete &&
					clockInSync(report.sentAt, await databaseNow(manager)),
				overflowWorkloadIds: workloads
					.filter(
						({ overflowed, organizationId }) => overflowed || !organizationId
					)
					.map(({ workloadId }) => workloadId),
			});
		});
	}

	async create(
		machineId: string,
		hostOrganizationId: string,
		userId: string,
		complaint: CreateIspComplaintDto
	): Promise<IspComplaintDto> {
		assertWindow(complaint);
		await this.ownedMachine(machineId, hostOrganizationId);
		const window = {
			from: addSeconds(
				complaint.observedFrom,
				-ISP_COMPLAINT_MATCHING.clockSkewSeconds
			),
			until: addSeconds(
				complaint.observedUntil,
				ISP_COMPLAINT_MATCHING.clockSkewSeconds
			),
		};
		const report = await this.entityManager
			.fork()
			.transactional(async (manager) => {
				const complete =
					complaint.protocol !== IspComplaintProtocol.ICMP &&
					(await this.recordsComplete(
						manager,
						machineId,
						complaint.sourceAddress,
						window
					));
				const matches = complete
					? await attributedWorkloads(manager, {
							machineId,
							destinationAddress: complaint.destinationAddress,
							destinationPort: complaint.destinationPort ?? null,
							protocol: complaint.protocol,
							...window,
						})
					: [];
				const outcome = complete
					? outcomeOf(matches)
					: IspComplaintOutcome.RECORDS_INCOMPLETE;
				const now = await databaseNow(manager);
				const { complaintText, ...details } = complaint;
				const created = manager.create(AbuseReport, {
					reporterType: AbuseReporterType.HOST,
					category: AbuseReportCategory.NETWORK_ABUSE,
					url: null,
					hostname: null,
					description: complaintText,
					reporterName: null,
					reporterEmail: null,
					reporterUserId: userId,
					reporterOrganizationId: hostOrganizationId,
					dmca: null,
					ispComplaint: details,
					ispOutcome: outcome,
					status: OUTCOME_STATUS[outcome],
					acknowledgedAt: now,
					machineId,
					dueAt: addSeconds(
						now,
						ABUSE_RESPONSE_TARGET_HOURS[ISP_COMPLAINT_TARGET] * SECONDS_PER_HOUR
					),
				});
				const [match] = matches;
				if (matches.length === SINGLE_MATCH && match) {
					created.organizationId = match.organizationId;
				}
				if (outcome === IspComplaintOutcome.ATTRIBUTED && match) {
					const abuseCase = await this.actions.openForReport(
						manager,
						{
							sandboxId: match.workloadId,
							organizationId: match.organizationId,
							machineId,
						},
						AbuseReportCategory.NETWORK_ABUSE,
						now
					);
					created.abuseCaseId = abuseCase.id;
					created.sandboxId = match.workloadId;
				}
				await manager.flush();
				return created;
			});
		if (report.abuseCaseId && report.sandboxId) {
			await this.evidence.capture(report.abuseCaseId, report.sandboxId, {
				previewUrl: null,
				restricted: false,
			});
		}
		return IspComplaintDto.from(report);
	}

	async list(
		machineId: string,
		hostOrganizationId: string
	): Promise<IspComplaintDto[]> {
		await this.ownedMachine(machineId, hostOrganizationId);
		const reports = await this.entityManager.fork().find(
			AbuseReport,
			{
				machineId,
				reporterOrganizationId: hostOrganizationId,
				reporterType: AbuseReporterType.HOST,
			},
			{ orderBy: { createdAt: 'DESC' }, limit: ISP_COMPLAINT_LIST_LIMIT }
		);
		return reports.map(IspComplaintDto.from);
	}

	async statement(
		machineId: string,
		hostOrganizationId: string,
		reportId: string
	): Promise<Buffer> {
		await this.ownedMachine(machineId, hostOrganizationId);
		const report = await this.entityManager.fork().findOne(AbuseReport, {
			id: reportId,
			machineId,
			reporterOrganizationId: hostOrganizationId,
			reporterType: AbuseReporterType.HOST,
		});
		if (!report?.ispComplaint || !report.ispOutcome) {
			throw new NotFoundException(
				apiError(
					AbuseReportErrorCode.REPORT_NOT_FOUND,
					'The complaint does not exist on this machine.'
				)
			);
		}
		const issuer = this.config.get('receipts').issuer;
		if (!issuer) {
			throw new ServiceUnavailableException(
				apiError(
					BillingReceiptErrorCode.NOT_CONFIGURED,
					'Statements are not available until the operator sets its legal details.'
				)
			);
		}
		return renderIspStatementPdf(
			ispStatementContent({
				reportId: report.id,
				machineId,
				issuedAt: report.createdAt,
				outcome: report.ispOutcome,
				complaint: report.ispComplaint,
			}),
			issuer
		);
	}

	private async recordsComplete(
		manager: EntityManager,
		machineId: string,
		sourceAddress: string,
		window: { from: Date; until: Date }
	): Promise<boolean> {
		const coverage = await connectionCoverage(
			manager,
			machineId,
			window,
			CONNECTION_RECORDS.retentionSeconds
		);
		return (
			!coverage.expired &&
			coverage.covered &&
			!coverage.overflowed &&
			(await machineAddressCovered(manager, machineId, sourceAddress, window))
		);
	}

	private async ownedMachine(
		machineId: string,
		organizationId: string
	): Promise<void> {
		const owned = await this.entityManager
			.fork()
			.count(Machine, { id: machineId, organizationId });
		if (owned === 0) throw new MachineNotFoundException(machineId);
	}
}

function outcomeOf(
	matches: Awaited<ReturnType<typeof attributedWorkloads>>
): IspComplaintOutcome {
	if (matches.length === NO_MATCH) return IspComplaintOutcome.NOT_SNAPFLOW;
	const [match] = matches;
	return matches.length === SINGLE_MATCH &&
		match?.workloadKind === ConnectionWorkloadKind.SANDBOX
		? IspComplaintOutcome.ATTRIBUTED
		: IspComplaintOutcome.MANUAL_REVIEW;
}

function reportWindow(report: MachineConnectionReportDto) {
	const windowStart = new Date(report.windowStart);
	const windowEnd = new Date(report.windowEnd);
	const seconds =
		(windowEnd.getTime() - windowStart.getTime()) / MILLISECONDS_PER_SECOND;
	if (seconds < 0 || seconds > CONNECTION_RECORDS.maximumWindowSeconds) {
		throw new BadRequestException(
			apiError(
				AbuseReportErrorCode.CONNECTION_WINDOW_INVALID,
				'The connection report period must end after it starts and span at most one day.'
			)
		);
	}
	return { windowStart, windowEnd };
}

function clockInSync(sentAt: string, now: Date): boolean {
	return (
		Math.abs(now.getTime() - new Date(sentAt).getTime()) <=
		CONNECTION_RECORDS.maximumClockSkewSeconds * MILLISECONDS_PER_SECOND
	);
}

function assertWindow(complaint: CreateIspComplaintDto): void {
	const seconds =
		(complaint.observedUntil.getTime() - complaint.observedFrom.getTime()) /
		MILLISECONDS_PER_SECOND;
	if (seconds < 0 || seconds > ISP_COMPLAINT_MATCHING.maximumWindowSeconds) {
		throw new BadRequestException(
			apiError(
				AbuseReportErrorCode.WINDOW_INVALID,
				'The complaint period must end after it starts and span at most 7 days.'
			)
		);
	}
}
