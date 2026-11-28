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
	NotFoundException,
} from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { ACTIVE_BACKEND_STATES } from '../../networking/constants/exposure.constants';
import { ExposureBackend } from '../../networking/entities/exposure-backend.entity';
import { NetworkControlVersionService } from '../../networking/services/network-control-version.service';
import { AbuseNoticeKind } from '../../notification/constants/notice.constants';
import { ORGANIZATION_SUSPENSION_REASON } from '../../organization/constants/organization-suspension.constants';
import { OrganizationSuspensionService } from '../../organization/services/organization-suspension.service';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { SandboxLifecycleService } from '../../sandbox/services/lifecycle/sandbox-lifecycle.service';
import { SandboxNetworkControlService } from '../../sandbox/services/sandbox/sandbox-network-control.service';
import {
	ABUSE_LADDER,
	AbuseCaseStatus,
	AbuseErrorCode,
} from '../constants/abuse.constants';
import {
	AbuseCaseAction,
	type AbuseReportCategory,
	AbuseReportErrorCode,
} from '../constants/abuse-report.constants';
import { AbuseCase } from '../entities/abuse-case.entity';
import { AbuseCaseActionRecord } from '../entities/abuse-case-action.entity';
import { AbuseReport } from '../entities/abuse-report.entity';
import type { HostnameOwner } from '../queries/abuse-hostname.query';
import { enqueueAbuseCaseNotices } from '../utils/abuse-notices.util';
import { AbuseEvidenceService } from './abuse-evidence.service';
import { AbuseLadderService } from './abuse-ladder.service';

const ACTION_NOTICE: Readonly<
	Partial<Record<AbuseCaseAction, AbuseNoticeKind>>
> = {
	[AbuseCaseAction.DISABLE_PREVIEW]: AbuseNoticeKind.PREVIEW_DISABLED,
	[AbuseCaseAction.BLOCK_EGRESS]: AbuseNoticeKind.EGRESS_BLOCKED,
	[AbuseCaseAction.PAUSE_SANDBOX]: AbuseNoticeKind.PAUSED,
	[AbuseCaseAction.TERMINATE_SANDBOX]: AbuseNoticeKind.TERMINATED,
	[AbuseCaseAction.SUSPEND_ORGANIZATION]: AbuseNoticeKind.SUSPENDED,
};

const DESTRUCTIVE_ACTIONS: ReadonlySet<AbuseCaseAction> = new Set([
	AbuseCaseAction.PAUSE_SANDBOX,
	AbuseCaseAction.TERMINATE_SANDBOX,
]);

type ActedCase = { abuseCase: AbuseCase; sandboxName: string };

type ReportOwner = Pick<
	HostnameOwner,
	'sandboxId' | 'organizationId' | 'machineId'
>;

@Injectable()
export class AbuseCaseActionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly ladder: AbuseLadderService,
		private readonly evidence: AbuseEvidenceService,
		private readonly versions: NetworkControlVersionService,
		private readonly networkControls: SandboxNetworkControlService,
		private readonly lifecycle: SandboxLifecycleService,
		private readonly suspensions: OrganizationSuspensionService
	) {}

	async openForReport(
		manager: EntityManager,
		owner: ReportOwner,
		category: AbuseReportCategory,
		now: Date
	): Promise<AbuseCase> {
		const open = await manager.findOne(
			AbuseCase,
			{ sandboxId: owner.sandboxId, status: { $ne: AbuseCaseStatus.RESOLVED } },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (open) {
			open.manual = true;
			return open;
		}
		const opened = manager.create(AbuseCase, {
			id: randomUUID(),
			sandboxId: owner.sandboxId,
			organizationId: owner.organizationId,
			machineId: owner.machineId,
			status: AbuseCaseStatus.OBSERVED,
			findings: {},
			firstSeenAt: now,
			lastSeenAt: now,
			manual: true,
		});
		await manager.flush();
		const sandbox = await manager.findOne(
			Sandbox,
			{ id: owner.sandboxId },
			{ fields: ['name'] }
		);
		await enqueueAbuseCaseNotices(
			manager,
			opened,
			sandbox?.name ?? owner.sandboxId,
			AbuseNoticeKind.CASE_OPENED,
			category,
			now
		);
		return opened;
	}

	async apply(
		caseId: string,
		action: AbuseCaseAction,
		actorId: string | null,
		note: string | null
	): Promise<AbuseCase> {
		const before = await this.openCase(this.entityManager.fork(), caseId);
		if (DESTRUCTIVE_ACTIONS.has(action)) {
			await this.evidence.capture(caseId, before.sandboxId, {
				previewUrl: null,
				restricted: await this.restricted(caseId),
			});
		}
		const { abuseCase, sandboxName } = await this.entityManager
			.fork()
			.transactional((manager) =>
				this.record(manager, caseId, action, actorId, note)
			);
		const enforced = await this.enforce(abuseCase, action);
		const kind = ACTION_NOTICE[action];
		if (kind) {
			await this.notify(enforced, sandboxName, kind);
		}
		return enforced;
	}

	async resolve(caseId: string, actorId: string | null): Promise<AbuseCase> {
		const abuseCase = await this.ladder.release(caseId, actorId);
		if (abuseCase.previewDisabledAt !== null) {
			await this.refreshEdges(abuseCase.sandboxId);
		}
		if (abuseCase.manual) {
			const sandbox = await this.entityManager
				.fork()
				.findOne(Sandbox, { id: abuseCase.sandboxId }, { fields: ['name'] });
			await this.notify(
				abuseCase,
				sandbox?.name ?? abuseCase.sandboxId,
				AbuseNoticeKind.RESOLVED
			);
		}
		return abuseCase;
	}

	async refreshEdges(sandboxId: string): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			const backends = await manager.find(
				ExposureBackend,
				{ sandboxId, state: { $in: ACTIVE_BACKEND_STATES } },
				{ fields: ['edgeId'] }
			);
			await this.versions.bumpEdges(
				manager,
				new Set(backends.map((backend) => backend.edgeId)),
				await databaseNow(manager)
			);
		});
	}

	private async record(
		manager: EntityManager,
		caseId: string,
		action: AbuseCaseAction,
		actorId: string | null,
		note: string | null
	): Promise<ActedCase> {
		const abuseCase = await this.openCase(
			manager,
			caseId,
			LockMode.PESSIMISTIC_WRITE
		);
		const now = await databaseNow(manager);
		abuseCase.manual = true;
		abuseCase.lastSeenAt = now;
		switch (action) {
			case AbuseCaseAction.DISABLE_PREVIEW:
				abuseCase.previewDisabledAt ??= now;
				break;
			case AbuseCaseAction.BLOCK_EGRESS:
				break;
			case AbuseCaseAction.PAUSE_SANDBOX:
				abuseCase.pausedAt ??= now;
				break;
			case AbuseCaseAction.TERMINATE_SANDBOX:
				abuseCase.terminatedAt ??= now;
				break;
			case AbuseCaseAction.SUSPEND_ORGANIZATION:
				abuseCase.organizationSuspendedAt ??= now;
				break;
			case AbuseCaseAction.REFER:
				abuseCase.referredAt ??= now;
				break;
		}
		manager.create(AbuseCaseActionRecord, {
			abuseCaseId: abuseCase.id,
			action,
			actorId,
			note,
		});
		const sandbox = await manager.findOne(
			Sandbox,
			{ id: abuseCase.sandboxId },
			{ fields: ['name'] }
		);
		await manager.flush();
		return { abuseCase, sandboxName: sandbox?.name ?? abuseCase.sandboxId };
	}

	private async enforce(
		abuseCase: AbuseCase,
		action: AbuseCaseAction
	): Promise<AbuseCase> {
		switch (action) {
			case AbuseCaseAction.DISABLE_PREVIEW:
				await this.refreshEdges(abuseCase.sandboxId);
				return abuseCase;
			case AbuseCaseAction.BLOCK_EGRESS:
				return this.blockEgress(abuseCase);
			case AbuseCaseAction.PAUSE_SANDBOX:
				await this.hold(abuseCase);
				return abuseCase;
			case AbuseCaseAction.TERMINATE_SANDBOX:
				if (await this.exists(abuseCase.sandboxId)) {
					await this.lifecycle.destroy(
						abuseCase.sandboxId,
						abuseCase.organizationId
					);
				}
				return abuseCase;
			case AbuseCaseAction.SUSPEND_ORGANIZATION:
				await this.suspensions.suspendUnlessSuspended(
					abuseCase.organizationId,
					{
						reason: ORGANIZATION_SUSPENSION_REASON.ABUSE,
						cleanupGracePeriodHours:
							ABUSE_LADDER.suspensionCleanupGracePeriodHours,
					}
				);
				await this.hold(abuseCase);
				return abuseCase;
			case AbuseCaseAction.REFER:
				return abuseCase;
		}
	}

	private async hold(abuseCase: AbuseCase): Promise<void> {
		if (await this.exists(abuseCase.sandboxId)) {
			await this.lifecycle.holdForAbuse(abuseCase.sandboxId);
		}
	}

	private async blockEgress(abuseCase: AbuseCase): Promise<AbuseCase> {
		if (!(await this.exists(abuseCase.sandboxId))) return abuseCase;
		return this.entityManager.fork().transactional(async (manager) => {
			await this.networkControls.applyAbuseControls(abuseCase.sandboxId, {
				abuseEgressBlock: true,
			});
			const blocked = await this.openCase(
				manager,
				abuseCase.id,
				LockMode.PESSIMISTIC_WRITE
			);
			blocked.egressBlockedAt ??= await databaseNow(manager);
			await manager.flush();
			return blocked;
		});
	}

	private async notify(
		abuseCase: AbuseCase,
		sandboxName: string,
		kind: AbuseNoticeKind
	): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			await enqueueAbuseCaseNotices(
				manager,
				abuseCase,
				sandboxName,
				kind,
				await this.category(manager, abuseCase.id),
				await databaseNow(manager)
			);
		});
	}

	private async openCase(
		manager: EntityManager,
		caseId: string,
		lockMode?: LockMode
	): Promise<AbuseCase> {
		const abuseCase = await manager.findOne(
			AbuseCase,
			{ id: caseId },
			{ lockMode }
		);
		if (!abuseCase) {
			throw new NotFoundException(
				apiError(
					AbuseErrorCode.CASE_NOT_FOUND,
					'The abuse case does not exist.'
				)
			);
		}
		if (abuseCase.status === AbuseCaseStatus.RESOLVED) {
			throw new ConflictException(
				apiError(
					AbuseReportErrorCode.ACTION_INVALID,
					'The abuse case is resolved; open a new case to act again.'
				)
			);
		}
		return abuseCase;
	}

	private async category(
		manager: EntityManager,
		caseId: string
	): Promise<AbuseReportCategory | null> {
		const report = await manager.findOne(
			AbuseReport,
			{ abuseCaseId: caseId },
			{ fields: ['category'], orderBy: { createdAt: 'ASC' } }
		);
		return report?.category ?? null;
	}

	private async restricted(caseId: string): Promise<boolean> {
		const restricted = await this.entityManager
			.fork()
			.count(AbuseReport, { abuseCaseId: caseId, restricted: true });
		return restricted > 0;
	}

	private async exists(sandboxId: string): Promise<boolean> {
		const sandbox = await this.entityManager
			.fork()
			.findOne(Sandbox, { id: sandboxId }, { fields: ['state'] });
		return sandbox !== null && sandbox.state !== SandboxState.DESTROYED;
	}
}
