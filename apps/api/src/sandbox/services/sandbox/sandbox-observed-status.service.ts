/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	type SandboxObservedStatus,
	type SandboxObservedStatusAcknowledgement,
	SandboxObservedStatusVerdict,
} from '@snapflow/machine-proto';
import {
	errorMessage,
	errorStack,
} from '../../../common/utils/error/error.util';
import { truncateErrorMessage } from '../../../common/utils/error/truncate-error-message.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { observeOperation } from '../../../infra/logging/utils/operation-observability.util';
import { MACHINE_OBSERVED_STATUS_LIMITS } from '../../../machine/constants/machine-desired-state.constants';
import type { MachineObservedStatusResultDto } from '../../../machine/dto/machine-sandbox-control.dto';
import type { MachineSession } from '../../../machine/entities/machine-session.entity';
import { MachineSessionService } from '../../../machine/services/machine-session.service';
import { MachineAssessmentService } from '../../../machine/services/qualification/machine-assessment.service';
import { MachineReliabilityService } from '../../../machine/services/qualification/machine-reliability.service';
import { convergenceExecutionResult } from '../../../machine/utils/desired-state/convergence-result.util';
import { CONVERGENCE_OUTCOME } from '../../constants/sandbox-state-machine.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { SandboxConflictException } from '../../exceptions/sandbox-conflict.exception';
import { runtimeConvergenceOutcome } from '../../utils/runtime/runtime-convergence.util';
import {
	decodeObservedStatusReport,
	encodeObservedStatusReportResult,
	observedStatusAcknowledgement,
	validateObservedStatus,
} from '../../utils/state/observed-status-report.util';
import { SandboxObservedStatusProjector } from './sandbox-observed-status.projector';

const STORE_OBSERVED_STATUS_SQL = `
insert into "sandbox_observed_status" ("sandboxId", "machineId", "assignmentGeneration", "observedSpecGeneration", "state", "errorReason", "recoverable", "daemonVersion", "observedAt", "receivedAt")
values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict ("sandboxId") do update set
	"machineId" = excluded."machineId",
	"assignmentGeneration" = excluded."assignmentGeneration",
	"observedSpecGeneration" = excluded."observedSpecGeneration",
	"state" = excluded."state",
	"errorReason" = excluded."errorReason",
	"recoverable" = excluded."recoverable",
	"daemonVersion" = excluded."daemonVersion",
	"observedAt" = excluded."observedAt",
	"receivedAt" = excluded."receivedAt"
where ("sandbox_observed_status"."assignmentGeneration", "sandbox_observed_status"."observedSpecGeneration", "sandbox_observed_status"."observedAt")
	<= (excluded."assignmentGeneration", excluded."observedSpecGeneration", excluded."observedAt")
	and ("sandbox_observed_status"."machineId", "sandbox_observed_status"."assignmentGeneration", "sandbox_observed_status"."observedSpecGeneration", "sandbox_observed_status"."state", "sandbox_observed_status"."errorReason", "sandbox_observed_status"."recoverable", "sandbox_observed_status"."daemonVersion")
	is distinct from (excluded."machineId", excluded."assignmentGeneration", excluded."observedSpecGeneration", excluded."state", excluded."errorReason", excluded."recoverable", excluded."daemonVersion")`;

interface AcceptedStatus {
	acknowledgement: SandboxObservedStatusAcknowledgement;
	attributed: boolean;
}

function unattributed(
	sandboxId: string,
	verdict: SandboxObservedStatusVerdict,
	reason?: string
): AcceptedStatus {
	return {
		acknowledgement: observedStatusAcknowledgement(sandboxId, verdict, reason),
		attributed: false,
	};
}

@Injectable()
export class SandboxObservedStatusService {
	private readonly logger = new Logger(SandboxObservedStatusService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		private readonly projector: SandboxObservedStatusProjector,
		private readonly reliability: MachineReliabilityService,
		private readonly assessments: MachineAssessmentService
	) {}

	report(
		machineId: string,
		session: MachineSession,
		encodedReport: string
	): Promise<MachineObservedStatusResultDto> {
		return observeOperation(
			'machine.observed_status.report',
			{},
			() => this.processReport(machineId, session, encodedReport),
			{ 'machine.id': machineId }
		);
	}

	private async processReport(
		machineId: string,
		session: MachineSession,
		encodedReport: string
	): Promise<MachineObservedStatusResultDto> {
		const statuses = decodeObservedStatusReport(encodedReport);
		const acknowledgements: SandboxObservedStatusAcknowledgement[] = [];
		let attributed = false;
		for (const status of statuses) {
			const accepted = await observeOperation(
				'machine.observed_status.accept',
				{},
				() => this.accept(machineId, session, status),
				{ 'sandbox.id': status.sandboxId }
			);
			acknowledgements.push(accepted.acknowledgement);
			attributed ||= accepted.attributed;
			if (
				accepted.acknowledgement.verdict ===
				SandboxObservedStatusVerdict.ACCEPTED
			) {
				await this.project(status);
			}
		}
		if (attributed) {
			await this.entityManager.transactional((manager) =>
				this.assessments.assess(manager, machineId)
			);
		}
		return { result: encodeObservedStatusReportResult(acknowledgements) };
	}

	private async accept(
		machineId: string,
		session: MachineSession,
		status: SandboxObservedStatus
	): Promise<AcceptedStatus> {
		const validation = validateObservedStatus(status);
		if (!validation.valid) {
			return unattributed(
				status.sandboxId,
				SandboxObservedStatusVerdict.INVALID,
				validation.defect
			);
		}
		return this.entityManager.transactional(async (manager) => {
			const receivedAt = await databaseNow(manager);
			await this.machineSessions.assertCurrent(
				manager,
				machineId,
				session.id,
				receivedAt
			);
			const sandbox = await manager.findOne(Sandbox, {
				id: status.sandboxId,
			});
			if (!sandbox) {
				return unattributed(
					status.sandboxId,
					SandboxObservedStatusVerdict.UNKNOWN
				);
			}
			const placement = await manager.findOne(SandboxPlacement, {
				sandboxId: sandbox.id,
				releasedAt: null,
			});
			if (
				placement?.machineId !== machineId ||
				placement.assignmentGeneration !== status.assignmentGeneration
			) {
				return unattributed(
					sandbox.id,
					SandboxObservedStatusVerdict.STALE,
					'The assignment is not active on this machine'
				);
			}
			if (status.observedSpecGeneration > sandbox.specGeneration) {
				return unattributed(
					sandbox.id,
					SandboxObservedStatusVerdict.INVALID,
					`Spec generation ${status.observedSpecGeneration} was never issued`
				);
			}
			await this.store(
				manager,
				machineId,
				status,
				validation.observedAt,
				receivedAt
			);
			return {
				acknowledgement: observedStatusAcknowledgement(
					sandbox.id,
					SandboxObservedStatusVerdict.ACCEPTED
				),
				attributed: await this.attribute(
					manager,
					sandbox,
					placement,
					session,
					status,
					receivedAt
				),
			};
		});
	}

	private async store(
		manager: EntityManager,
		machineId: string,
		status: SandboxObservedStatus,
		observedAt: Date,
		receivedAt: Date
	): Promise<void> {
		await manager.execute(STORE_OBSERVED_STATUS_SQL, [
			status.sandboxId,
			machineId,
			status.assignmentGeneration,
			status.observedSpecGeneration,
			status.state,
			status.errorReason === undefined
				? null
				: truncateErrorMessage(
						status.errorReason,
						MACHINE_OBSERVED_STATUS_LIMITS.maximumErrorReasonLength
					),
			status.recoverable,
			status.daemonVersion ?? null,
			observedAt,
			receivedAt,
		]);
	}

	private async attribute(
		manager: EntityManager,
		sandbox: Sandbox,
		placement: SandboxPlacement,
		session: MachineSession,
		status: SandboxObservedStatus,
		recordedAt: Date
	): Promise<boolean> {
		const outcome = runtimeConvergenceOutcome(
			sandbox.runtimeLifecycle,
			status.state
		);
		if (
			!status.result ||
			outcome === CONVERGENCE_OUTCOME.PENDING ||
			status.observedSpecGeneration !== sandbox.specGeneration
		) {
			return false;
		}
		return this.reliability.recordSandboxConvergence(manager, {
			placement,
			sandbox,
			machineSessionId: session.id,
			specGeneration: status.observedSpecGeneration,
			result: convergenceExecutionResult(
				status.result,
				outcome === CONVERGENCE_OUTCOME.SUCCEEDED
			),
			observedAt: recordedAt,
		});
	}

	private async project(status: SandboxObservedStatus): Promise<void> {
		try {
			await observeOperation(
				'machine.observed_status.project',
				{},
				() => this.projector.project(status),
				{ 'sandbox.id': status.sandboxId }
			);
		} catch (error) {
			if (error instanceof SandboxConflictException) {
				this.logger.debug(
					`Sandbox ${status.sandboxId} changed while its observed status was projected`
				);
				return;
			}
			this.logger.error(
				`Failed to project the observed status of sandbox ${status.sandboxId}: ${errorMessage(error)}`,
				errorStack(error)
			);
		}
	}
}
