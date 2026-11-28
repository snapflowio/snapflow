/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MINIMUM_BILLABLE_HOURLY_MICRO_USD } from '../../../billing/constants/billing-admission.constants';
import { BILLING_POLICY } from '../../../billing/constants/billing-policy.constants';
import {
	FUNDING_POLICY,
	FundingEvents,
	FundingNoticeKind,
} from '../../../billing/constants/funding.constants';
import { OrganizationFunding } from '../../../billing/entities/organization-funding.entity';
import { ApiKeyBudgetExhaustedEvent } from '../../../billing/events/api-key-budget-exhausted.event';
import {
	type FundingNotice,
	FundingNoticeEvent,
} from '../../../billing/events/funding-notice.event';
import { ApiKeyBudgetService } from '../../../billing/services/api-key-budget.service';
import {
	BillingRunwayService,
	type OrganizationRunway,
} from '../../../billing/services/billing-runway.service';
import {
	fundsExhausted,
	runwayWarning,
	unfundedArchivesDeleteAt,
	warningIsNew,
} from '../../../billing/utils/funding/runway.util';
import {
	SECONDS_PER_DAY,
	SECONDS_PER_MINUTE,
} from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { addSeconds } from '../../../common/utils/time.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	cooldownNoticeKey,
	enqueueApiKeyBudgetExhausted,
	enqueueFundingNotice,
} from '../../../notification/utils/notice-outbox.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { autoTopUpHealthy } from '../../../settlement/queries/auto-top-up-state.query';
import { configuredEscrow } from '../../../settlement/utils/escrow/escrow-identity.util';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { SnapshotService } from '../../../snapshot/services/snapshot.service';
import { Volume } from '../../../volume/entities/volume.entity';
import { VolumeState } from '../../../volume/enums/volume-state.enum';
import { VolumeProvisioningService } from '../../../volume/services/volume-provisioning.service';
import { StartSandboxDto } from '../../dto/sandbox-placement.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxIdlePolicyManager } from '../../managers/sandbox-idle-policy.manager';
import { SandboxLifecycleService } from '../lifecycle/sandbox-lifecycle.service';

const RESTARTABLE_STATES = [SandboxState.STOPPED, SandboxState.ARCHIVED];

const RELEASED_VOLUME_STATES = [
	VolumeState.PENDING_DELETE,
	VolumeState.DELETING,
	VolumeState.DELETED,
];

const CANDIDATES_SQL = `
	SELECT DISTINCT price."customerOrganizationId" AS id
	FROM placement_price price
	WHERE price."endedAt" IS NULL
	UNION
	SELECT funding."organizationId" AS id
	FROM organization_funding funding
	WHERE funding."runwayWarning" IS NOT NULL
	   OR (funding."computeStoppedAt" IS NOT NULL AND funding."archivesDeletedAt" IS NULL)
	LIMIT ?`;

@Injectable()
export class SandboxFundingPolicyService {
	private readonly logger = new Logger(SandboxFundingPolicyService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly runway: BillingRunwayService,
		private readonly apiKeyBudgets: ApiKeyBudgetService,
		private readonly idlePolicy: SandboxIdlePolicyManager,
		private readonly settings: SettingsService,
		private readonly config: TypedConfigService,
		private readonly snapshots: SnapshotService,
		private readonly volumes: VolumeProvisioningService,
		private readonly lifecycle: SandboxLifecycleService
	) {}

	async apply(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const candidates = await this.entityManager.execute<{ id: string }[]>(
				CANDIDATES_SQL,
				[FUNDING_POLICY.batchSize]
			);
			for (const { id } of candidates) {
				try {
					await this.applyToOrganization(id);
				} catch (error) {
					this.logger.error(
						`Funding policy failed for organization ${id}: ${errorMessage(error)}`
					);
				}
			}
			await this.stopExhaustedApiKeys();
		});
	}

	private async applyToOrganization(organizationId: string): Promise<void> {
		const manager = this.entityManager.fork();
		const now = await databaseNow(manager);
		const runway = await this.runway.runway(manager, organizationId);
		const state =
			(await manager.findOne(OrganizationFunding, { organizationId })) ??
			manager.create(OrganizationFunding, { organizationId });
		const notices: [string, FundingNotice][] = [];
		const wasStopped = state.computeStoppedAt !== null;
		if (state.computeStoppedAt) {
			await this.whileStopped(manager, state, runway, now, notices);
		} else if (await this.exhausted(runway)) {
			await this.idlePolicy.stopAndArchiveOrganization(organizationId);
			state.computeStoppedAt = now;
			state.runwayWarning = null;
			notices.push([
				`compute-stopped:${organizationId}:${now.getTime()}`,
				{
					kind: FundingNoticeKind.COMPUTE_STOPPED,
					archivesDeleteAt: unfundedArchivesDeleteAt(now).toISOString(),
				},
			]);
		} else {
			await this.warn(manager, state, runway, now, notices);
		}
		await manager.flush();
		if (wasStopped && !state.computeStoppedAt) {
			await this.restartFundsStopped(organizationId);
		}
		for (const [noticeId, notice] of notices) {
			await enqueueFundingNotice(
				manager,
				new FundingNoticeEvent(organizationId, noticeId, notice, now)
			);
		}
	}

	private async exhausted(runway: OrganizationRunway): Promise<boolean> {
		const { fundsStopMarginMinutes } = await this.settings.get();
		return fundsExhausted(
			runway.funding.spendableMicroUsd,
			runway.burnMicroUsdPerHour,
			(BILLING_POLICY.accountingWindowMinutes + fundsStopMarginMinutes) *
				SECONDS_PER_MINUTE
		);
	}

	private async whileStopped(
		manager: EntityManager,
		state: OrganizationFunding,
		runway: OrganizationRunway,
		now: Date,
		notices: [string, FundingNotice][]
	): Promise<void> {
		const { computeStoppedAt, organizationId } = state;
		if (!computeStoppedAt) return;
		const funded =
			runway.funding.walletReady &&
			runway.funding.spendableMicroUsd.atLeast(
				this.runway.startRequirement(runway, MINIMUM_BILLABLE_HOURLY_MICRO_USD)
			);
		if (funded) {
			manager.assign(state, {
				computeStoppedAt: null,
				archiveDeletionNoticeAt: null,
				archivesDeletedAt: null,
				runwayWarning: null,
				runwayWarnedAt: null,
			});
			return;
		}
		if (state.archivesDeletedAt) return;
		const deleteAt = unfundedArchivesDeleteAt(computeStoppedAt);
		if (now >= deleteAt) {
			await this.idlePolicy.deleteArchivedOfOrganization(organizationId);
			if (await this.releaseStoredData(organizationId)) {
				state.archivesDeletedAt = now;
			}
			return;
		}
		await this.idlePolicy.stopAndArchiveOrganization(organizationId);
		const noticeAt = addSeconds(
			deleteAt,
			-FUNDING_POLICY.archiveDeletionNoticeSeconds
		);
		if (now >= noticeAt && !state.archiveDeletionNoticeAt) {
			state.archiveDeletionNoticeAt = now;
			notices.push([
				`archive-deletion:${organizationId}:${computeStoppedAt.getTime()}`,
				{
					kind: FundingNoticeKind.ARCHIVE_DELETION_SCHEDULED,
					archivesDeleteAt: deleteAt.toISOString(),
				},
			]);
		}
	}

	private async restartFundsStopped(organizationId: string): Promise<void> {
		const manager = this.entityManager.fork();
		const sandboxes = await manager.find(
			Sandbox,
			{
				organizationId,
				fundsStoppedAt: { $ne: null },
				pending: false,
				state: { $in: RESTARTABLE_STATES },
			},
			{ fields: ['id'] }
		);
		for (const { id } of sandboxes) {
			try {
				await this.lifecycle.start(id, organizationId, new StartSandboxDto());
			} catch (error) {
				this.logger.warn(
					`Could not restart sandbox ${id} after funding returned: ${errorMessage(error)}`
				);
				await manager.nativeUpdate(Sandbox, { id }, { fundsStoppedAt: null });
			}
		}
	}

	private async releaseStoredData(organizationId: string): Promise<boolean> {
		const manager = this.entityManager.fork();
		const snapshots = await manager.find(
			Snapshot,
			{
				organizationId,
				general: false,
				state: { $ne: SnapshotState.REMOVING },
			},
			{ fields: ['id'] }
		);
		for (const { id } of snapshots) {
			await this.snapshots.removeSnapshot(id);
		}
		const volumes = await manager.find(
			Volume,
			{ organizationId, state: { $nin: RELEASED_VOLUME_STATES } },
			{ fields: ['id'] }
		);
		let retained = 0;
		for (const { id } of volumes) {
			try {
				await this.volumes.delete(id);
			} catch (error) {
				retained += 1;
				this.logger.warn(
					`Volume ${id} of unfunded organization ${organizationId} is not deletable yet: ${errorMessage(error)}`
				);
			}
		}
		return retained === 0;
	}

	private async warn(
		manager: EntityManager,
		state: OrganizationFunding,
		runway: OrganizationRunway,
		now: Date,
		notices: [string, FundingNotice][]
	): Promise<void> {
		const level = runwayWarning(runway.runwaySeconds);
		if (level === null || runway.runwaySeconds === null) {
			state.runwayWarning = null;
			return;
		}
		if (!warningIsNew(level, state.runwayWarning)) return;
		if (
			await autoTopUpHealthy(
				manager,
				configuredEscrow(this.config),
				this.config.get('settlement.relayerAddress'),
				state.organizationId
			)
		) {
			return;
		}
		state.runwayWarning = level;
		state.runwayWarnedAt = now;
		notices.push([
			`runway:${state.organizationId}:${level}:${now.getTime()}`,
			{
				kind: FundingNoticeKind.RUNWAY_WARNING,
				warning: level,
				runwaySeconds: runway.runwaySeconds.toString(),
				burnMicroUsdPerHour: runway.burnMicroUsdPerHour.toString(),
			},
		]);
	}

	private async stopExhaustedApiKeys(): Promise<void> {
		const manager = this.entityManager.fork();
		for (const budget of await this.apiKeyBudgets.spendExhaustedBudgets()) {
			const stopped = await this.idlePolicy.stopApiKeySandboxes(
				budget.apiKeyId
			);
			if (stopped === 0 || budget.computeSpendLimitMicroUsd === null) continue;
			const now = await databaseNow(manager);
			await enqueueApiKeyBudgetExhausted(
				manager,
				new ApiKeyBudgetExhaustedEvent(
					budget.organizationId,
					cooldownNoticeKey(
						now,
						FUNDING_POLICY.apiKeyBudgetWindowDays * SECONDS_PER_DAY,
						FundingEvents.API_KEY_BUDGET_EXHAUSTED,
						budget.apiKeyId,
						String(budget.updatedAt.getTime())
					),
					budget.apiKeyId,
					budget.computeSpendLimitMicroUsd,
					stopped,
					now
				)
			);
		}
	}
}
