/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { errorMessage } from '../../common/utils/error/error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { AbuseNoticeKind } from '../../notification/constants/notice.constants';
import { ORGANIZATION_SUSPENSION_REASON } from '../../organization/constants/organization-suspension.constants';
import { OrganizationSuspensionService } from '../../organization/services/organization-suspension.service';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { SandboxLifecycleService } from '../../sandbox/services/lifecycle/sandbox-lifecycle.service';
import {
	RELEASED_ABUSE_CONTROLS,
	SandboxNetworkControlService,
	throttleControls,
} from '../../sandbox/services/sandbox/sandbox-network-control.service';
import type { AbuseEnforcementMode } from '../../settings/constants/settings.constants';
import {
	ABUSE_LADDER,
	ABUSE_THROTTLE,
	AbuseCaseStatus,
	AbuseErrorCode,
} from '../constants/abuse.constants';
import type { MachineAbuseFindingDto } from '../dto/machine-abuse-report.dto';
import { AbuseCase } from '../entities/abuse-case.entity';
import { mergeFindings, nextAbuseStatus } from '../utils/abuse-ladder.util';
import { enqueueAbuseCaseNotices } from '../utils/abuse-notices.util';

type ReportedSandbox = Pick<Sandbox, 'id' | 'organizationId' | 'name'>;

interface LadderStep {
	abuseCase: AbuseCase;
	previousStatus: AbuseCaseStatus;
}

const NOTICE_KIND_BY_STATUS: Partial<Record<AbuseCaseStatus, AbuseNoticeKind>> =
	{
		[AbuseCaseStatus.THROTTLED]: AbuseNoticeKind.THROTTLED,
		[AbuseCaseStatus.SUSPENDED]: AbuseNoticeKind.SUSPENDED,
	};

@Injectable()
export class AbuseLadderService {
	private readonly logger = new Logger(AbuseLadderService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly networkControls: SandboxNetworkControlService,
		private readonly lifecycle: SandboxLifecycleService,
		private readonly suspensions: OrganizationSuspensionService
	) {}

	async escalate(
		sandbox: ReportedSandbox,
		machineId: string,
		reported: readonly MachineAbuseFindingDto[],
		mode: AbuseEnforcementMode
	): Promise<void> {
		const step = await this.entityManager
			.fork()
			.transactional((manager) =>
				this.recordStep(manager, sandbox, machineId, reported, mode)
			);
		await this.enforce(step);
	}

	async release(caseId: string, resolvedBy: string | null): Promise<AbuseCase> {
		const { abuseCase, previousStatus } = await this.entityManager
			.fork()
			.transactional(async (manager) => {
				const found = await manager.findOne(
					AbuseCase,
					{ id: caseId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!found) {
					throw new NotFoundException(
						apiError(
							AbuseErrorCode.CASE_NOT_FOUND,
							'The abuse case does not exist.'
						)
					);
				}
				if (found.status === AbuseCaseStatus.RESOLVED) {
					throw new ConflictException(
						apiError(
							AbuseErrorCode.CASE_RESOLVED,
							'The abuse case is already resolved.'
						)
					);
				}
				const previous = found.status;
				found.status = AbuseCaseStatus.RESOLVED;
				found.resolvedAt = await databaseNow(manager);
				found.resolvedBy = resolvedBy;
				await manager.flush();
				return { abuseCase: found, previousStatus: previous };
			});
		await this.releaseControls(abuseCase.sandboxId);
		if (
			previousStatus === AbuseCaseStatus.SUSPENDED ||
			abuseCase.organizationSuspendedAt !== null
		) {
			await this.liftSuspensionIfClear(abuseCase.organizationId);
		}
		return abuseCase;
	}

	async releaseControls(sandboxId: string): Promise<void> {
		const sandbox = await this.entityManager
			.fork()
			.findOne(Sandbox, { id: sandboxId }, { fields: ['state'] });
		if (!sandbox || sandbox.state === SandboxState.DESTROYED) return;
		await this.networkControls
			.applyAbuseControls(sandboxId, RELEASED_ABUSE_CONTROLS)
			.catch((error: unknown) =>
				this.logger.warn(
					`Could not release the abuse controls of sandbox ${sandboxId}: ${errorMessage(error)}`
				)
			);
	}

	private async recordStep(
		manager: EntityManager,
		sandbox: ReportedSandbox,
		machineId: string,
		reported: readonly MachineAbuseFindingDto[],
		mode: AbuseEnforcementMode
	): Promise<LadderStep> {
		const now = await databaseNow(manager);
		const abuseCase =
			(await manager.findOne(
				AbuseCase,
				{ sandboxId: sandbox.id, status: { $ne: AbuseCaseStatus.RESOLVED } },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			)) ??
			manager.create(AbuseCase, {
				id: randomUUID(),
				sandboxId: sandbox.id,
				organizationId: sandbox.organizationId,
				machineId,
				status: AbuseCaseStatus.OBSERVED,
				findings: {},
				firstSeenAt: now,
				lastSeenAt: now,
			});
		const previousStatus = abuseCase.status;
		abuseCase.machineId = machineId;
		abuseCase.lastSeenAt = now;
		abuseCase.findings = mergeFindings(abuseCase.findings, reported, now);
		abuseCase.status = nextAbuseStatus(abuseCase, reported, mode, now);
		const noticeKind = NOTICE_KIND_BY_STATUS[abuseCase.status];
		if (abuseCase.status !== previousStatus && noticeKind) {
			if (abuseCase.status === AbuseCaseStatus.THROTTLED) {
				abuseCase.throttledAt = now;
			} else {
				abuseCase.suspendedAt = now;
			}
			abuseCase.notifiedAt = now;
			await enqueueAbuseCaseNotices(
				manager,
				abuseCase,
				sandbox.name,
				noticeKind,
				null,
				now
			);
		}
		await manager.flush();
		return { abuseCase, previousStatus };
	}

	private async enforce({
		abuseCase,
		previousStatus,
	}: LadderStep): Promise<void> {
		if (abuseCase.status === AbuseCaseStatus.THROTTLED) {
			await this.networkControls
				.applyAbuseControls(
					abuseCase.sandboxId,
					throttleControls(ABUSE_THROTTLE)
				)
				.catch((error: unknown) =>
					this.logger.warn(
						`Could not throttle sandbox ${abuseCase.sandboxId}: ${errorMessage(error)}`
					)
				);
			return;
		}
		if (
			abuseCase.status !== AbuseCaseStatus.SUSPENDED ||
			previousStatus === AbuseCaseStatus.SUSPENDED
		) {
			return;
		}
		await this.suspensions.suspendUnlessSuspended(abuseCase.organizationId, {
			reason: ORGANIZATION_SUSPENSION_REASON.ABUSE,
			cleanupGracePeriodHours: ABUSE_LADDER.suspensionCleanupGracePeriodHours,
		});
		await this.lifecycle
			.holdForAbuse(abuseCase.sandboxId)
			.catch((error: unknown) =>
				this.logger.error(
					`Could not hold abusive sandbox ${abuseCase.sandboxId}: ${errorMessage(error)}`
				)
			);
	}

	private async liftSuspensionIfClear(organizationId: string): Promise<void> {
		const stillSuspended = await this.entityManager.fork().count(AbuseCase, {
			organizationId,
			$or: [
				{ status: AbuseCaseStatus.SUSPENDED },
				{
					status: { $ne: AbuseCaseStatus.RESOLVED },
					organizationSuspendedAt: { $ne: null },
				},
			],
		});
		if (stillSuspended > 0) return;
		await this.suspensions.liftSuspensions(
			[organizationId],
			ORGANIZATION_SUSPENSION_REASON.ABUSE
		);
	}
}
