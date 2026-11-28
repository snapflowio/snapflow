/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ORGANIZATION_CONTEXT_SEARCH_PARAM } from '@snapflow/organization-access';
import {
	AUDIT_ACTOR_TYPE,
	AUDIT_CREDENTIAL_TYPE,
} from '../../audit/constants/audit-principal.constants';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { AuditService } from '../../audit/services/audit.service';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	enqueueLimitsNotice,
	noticeKey,
} from '../../notification/utils/notice-outbox.util';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SettingsService } from '../../settings/services/settings.service';
import { configuredEscrow } from '../../settlement/utils/escrow/escrow-identity.util';
import {
	LIMITS_PAGE_PATH,
	LimitsNoticeKind,
	NO_QUOTA_TIER,
	QUOTA_TIER_SWEEP,
	QUOTA_TIER_TRAILING_WINDOW_DAYS,
	QuotaTierEvents,
} from '../constants/organization-quota-tier.constants';
import { OrganizationQuotaTierDto } from '../dto/organization-quota-tier.dto';
import { Organization } from '../entities/organization.entity';
import { LimitsNoticeEvent } from '../events/limits-notice.event';
import type { QuotaTierEvaluationEvent } from '../events/quota-tier-evaluation.event';
import { organizationQuotaStandings } from '../queries/organization-quota-standings.query';
import type {
	QuotaTier,
	QuotaTierLimitKey,
	QuotaTierStanding,
} from '../types/quota-tier.types';
import {
	describeTierLimit,
	earnedTier,
	nextTier,
	sortedTiers,
	tierClassLimits,
	tierUnlockRequirement,
	trailingWindowStart,
} from '../utils/quota-tier.util';

const QUOTA_TIER_AUDIT_ACTOR_ID = 'quota-tier-evaluator';

interface TierChange {
	previousTier: number;
	tier: number;
}

@Injectable()
export class OrganizationQuotaTierService {
	private readonly logger = new Logger(OrganizationQuotaTierService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly config: TypedConfigService,
		private readonly audit: AuditService
	) {}

	async tiers(): Promise<QuotaTier[]> {
		return sortedTiers((await this.settings.get()).quotaTiers);
	}

	async heldTier(organizationId: string): Promise<number> {
		const organization = await this.entityManager.findOne(
			Organization,
			{ id: organizationId },
			{ fields: ['quotaTier'] }
		);
		if (!organization) {
			throw new NotFoundException(`Organization ${organizationId} not found`);
		}
		return organization.quotaTier;
	}

	async standing(
		organizationId: string,
		manager: EntityManager = this.entityManager
	): Promise<QuotaTierStanding> {
		const [standing] = await this.standings(manager, [organizationId]);
		if (!standing) {
			throw new NotFoundException(`Organization ${organizationId} not found`);
		}
		return standing;
	}

	async initialize(
		organization: Organization,
		manager: EntityManager = this.entityManager
	): Promise<void> {
		const standing = await this.standing(organization.id, manager);
		organization.quotaTier = earnedTier(
			await this.tiers(),
			organization.quotaTier,
			standing
		);
		organization.quotaTierChangedAt = await databaseNow(manager);
		await manager.flush();
	}

	async initializeById(organizationId: string): Promise<void> {
		const manager = this.entityManager.fork();
		const organization = await manager.findOne(Organization, {
			id: organizationId,
		});
		if (!organization) {
			throw new NotFoundException(`Organization ${organizationId} not found`);
		}
		await this.initialize(organization, manager);
	}

	async evaluate(organizationId: string): Promise<void> {
		const tiers = await this.tiers();
		const change = await this.entityManager
			.fork()
			.transactional((manager) =>
				this.evaluateLocked(manager, organizationId, tiers)
			);
		if (change) {
			await this.audit.createCompletedLog({
				actorType: AUDIT_ACTOR_TYPE.SYSTEM,
				actorId: QUOTA_TIER_AUDIT_ACTOR_ID,
				credentialType: AUDIT_CREDENTIAL_TYPE.SYSTEM,
				organizationId,
				action: AuditAction.UPDATE_QUOTA_TIER,
				targetType: AuditTarget.ORGANIZATION,
				targetId: organizationId,
				statusCode: HttpStatus.OK,
				metadata: { ...change },
			});
		}
	}

	async sweep(): Promise<void> {
		const tiers = await this.tiers();
		const manager = this.entityManager.fork();
		let after = await this.sweepBatch(manager, tiers, null);
		while (after !== null) {
			after = await this.sweepBatch(manager, tiers, after);
		}
	}

	private async sweepBatch(
		manager: EntityManager,
		tiers: readonly QuotaTier[],
		after: string | null
	): Promise<string | null> {
		const batch = await manager.find(
			Organization,
			after ? { deletedAt: null, id: { $gt: after } } : { deletedAt: null },
			{
				fields: ['quotaTier'],
				orderBy: { id: 'ASC' },
				limit: QUOTA_TIER_SWEEP.batchSize,
			}
		);
		manager.clear();
		const last = batch.at(-1);
		if (!last) return null;
		const held = new Map(
			batch.map((organization) => [organization.id, organization.quotaTier])
		);
		const standings = await this.standings(manager, [...held.keys()]);
		for (const standing of standings) {
			const heldTier = held.get(standing.organizationId) ?? NO_QUOTA_TIER;
			if (earnedTier(tiers, heldTier, standing) !== heldTier) {
				await this.evaluateLogged(standing.organizationId);
			}
		}
		return last.id;
	}

	@OnEvent(QuotaTierEvents.EVALUATE)
	@IsolatedEntityManagerContext()
	async handleEvaluation(event: QuotaTierEvaluationEvent): Promise<void> {
		await this.evaluate(event.organizationId);
	}

	async overview(organizationId: string): Promise<OrganizationQuotaTierDto> {
		const tiers = await this.tiers();
		const tier = await this.heldTier(organizationId);
		const standing = await this.standing(organizationId);
		return {
			tier,
			nextTier: nextTier(tiers, tier)?.tier ?? null,
			verifiedEmail: standing.verifiedEmail,
			lifetimeDepositMicroUsd: standing.lifetimeDeposits.toString(),
			trailingDepositMicroUsd: standing.trailingDeposits.toString(),
			trailingWindowDays: QUOTA_TIER_TRAILING_WINDOW_DAYS,
			tiers,
		};
	}

	async limitHint(
		organizationId: string,
		sandboxClass: SandboxClass,
		limit: QuotaTierLimitKey
	): Promise<string> {
		const tiers = await this.tiers();
		const current = await this.heldTier(organizationId);
		const requestLimits = this.requestLimitsText(organizationId);
		const currentText =
			current === NO_QUOTA_TIER
				? 'This organization has no tier yet.'
				: `This organization is on Tier ${current}.`;
		const next = nextTier(tiers, current);
		if (!next) {
			return `${currentText} It is the highest tier; ${requestLimits}.`;
		}
		const unlock = tierUnlockRequirement(
			next,
			await this.standing(organizationId)
		);
		const amount = tierClassLimits(tiers, next.tier, sandboxClass)?.[limit];
		const reach =
			amount === undefined
				? `to reach Tier ${next.tier}`
				: `to reach Tier ${next.tier}: ${describeTierLimit(limit, amount)}`;
		return `${currentText} ${unlock} ${reach}, or ${requestLimits}.`;
	}

	private requestLimitsText(organizationId: string): string {
		const dashboardUrl = this.config.get('dashboardUrl');
		if (!dashboardUrl) {
			return 'request higher limits on the Limits page of the dashboard';
		}
		const limitsUrl = new URL(`${dashboardUrl}${LIMITS_PAGE_PATH}`);
		limitsUrl.searchParams.set(
			ORGANIZATION_CONTEXT_SEARCH_PARAM,
			organizationId
		);
		return `request higher limits at ${limitsUrl}`;
	}

	private async evaluateLocked(
		manager: EntityManager,
		organizationId: string,
		tiers: readonly QuotaTier[]
	): Promise<TierChange | null> {
		const organization = await manager.findOne(
			Organization,
			{ id: organizationId, deletedAt: null },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!organization) return null;
		const previousTier = organization.quotaTier;
		const tier = earnedTier(
			tiers,
			previousTier,
			await this.standing(organizationId, manager)
		);
		if (tier === previousTier) return null;
		const now = await databaseNow(manager);
		organization.quotaTier = tier;
		organization.quotaTierChangedAt = now;
		if (tier > previousTier && previousTier > NO_QUOTA_TIER) {
			await enqueueLimitsNotice(
				manager,
				new LimitsNoticeEvent(
					organizationId,
					noticeKey(
						LimitsNoticeKind.TIER_UPGRADED,
						organizationId,
						tier,
						now.getTime()
					),
					{ kind: LimitsNoticeKind.TIER_UPGRADED, previousTier, tier },
					now
				)
			);
		}
		return { previousTier, tier };
	}

	private async evaluateLogged(organizationId: string): Promise<void> {
		try {
			await this.evaluate(organizationId);
		} catch (error) {
			this.logger.error(
				`Could not evaluate the quota tier of organization ${organizationId}: ${errorMessage(error)}`,
				errorStack(error)
			);
		}
	}

	private async standings(
		manager: EntityManager,
		organizationIds: readonly string[]
	): Promise<QuotaTierStanding[]> {
		return organizationQuotaStandings(
			manager,
			configuredEscrow(this.config),
			organizationIds,
			trailingWindowStart(await databaseNow(manager))
		);
	}
}
