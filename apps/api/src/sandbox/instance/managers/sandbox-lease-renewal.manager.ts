/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { leaseShape } from '../../../billing/ledger/utils/lease-pricing.util';
import { MILLISECONDS_PER_DAY } from '../../../common/constants/time.constants';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { MachineListing } from '../../../marketplace/machine/entities/machine-listing.entity';
import { MachinePriceCard } from '../../../marketplace/machine/entities/machine-price-card.entity';
import { SandboxLease } from '../../../marketplace/machine/entities/sandbox-lease.entity';
import { LeaseRenewalState } from '../../../marketplace/machine/enums/lease-renewal-state.enum';
import {
	egressPricePerGiB,
	priceTerms,
	runningHourlyPrice,
} from '../../../marketplace/machine/utils/pricing.util';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import { SandboxPlacementService } from '../../placement/services/sandbox-placement.service';
import { SandboxPlacementControlService } from '../../placement/services/sandbox-placement-control.service';
import {
	LeaseRenewalDecision,
	type LeaseRenewalPrices,
	leaseRenewalDecision,
} from '../../placement/utils/lease-renewal.util';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import {
	SANDBOX_LEASE_BATCH_SIZE,
	SANDBOX_LEASE_JOB,
} from '../constants/sandbox-placement.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxLeaseRenewalRequiredEvent } from '../events/sandbox-lease-renewal-required.event';
import { SandboxRepository } from '../repositories/sandbox.repository';

const LEASE_JOB_LOCK_TTL_SECONDS = 300;

@Injectable()
export class SandboxLeaseRenewalManager extends TrackedJobs {
	protected readonly logger = new Logger(SandboxLeaseRenewalManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly placements: SandboxPlacementService,
		private readonly placementControl: SandboxPlacementControlService,
		private readonly settings: SettingsService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly eventEmitter: EventEmitter2
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(SANDBOX_LEASE_JOB.RENEWAL)
	@CreateRequestContext()
	async renewExpiredLeases(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			SANDBOX_LEASE_JOB.RENEWAL,
			LEASE_JOB_LOCK_TTL_SECONDS,
			async () => {
				const now = await databaseNow(this.entityManager);
				const expired = await this.entityManager.find(
					SandboxLease,
					{
						endedAt: null,
						renewalState: LeaseRenewalState.NONE,
						priceLockedUntil: { $lte: now },
					},
					{
						orderBy: { priceLockedUntil: 'ASC' },
						limit: SANDBOX_LEASE_BATCH_SIZE,
					}
				);
				await settleSequentially(expired, (lease) =>
					this.reviewLease(lease.id).catch((error: unknown) =>
						this.logger.error(`Could not renew lease ${lease.id}`, error)
					)
				);
				await this.stopPastDeadline(now);
			}
		);
	}

	private async reviewLease(leaseId: string): Promise<void> {
		const required = await this.entityManager.transactional(async (manager) => {
			const lease = await manager.findOne(
				SandboxLease,
				{ id: leaseId, endedAt: null, renewalState: LeaseRenewalState.NONE },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!lease) return null;
			const sandbox = await manager.findOneOrFail(Sandbox, {
				id: lease.sandboxId,
			});
			const decision = leaseRenewalDecision({
				selfUse: lease.priceCardId === null,
				lease: {
					hourlyGrossMicroUsd: await this.placements.hourlyGross(
						manager,
						lease
					),
					egressGrossMicroUsdPerGiB: await this.placements.egressGross(
						manager,
						lease
					),
				},
				current: await this.currentPrices(manager, lease),
				maxHourlyPriceMicroUsd: MicroUsd.parseNullable(
					sandbox.maxHourlyPriceMicroUsd
				),
				maxEgressMicroUsdPerGiB: MicroUsd.parseNullable(
					sandbox.maxEgressMicroUsdPerGiB
				),
			});
			if (decision === LeaseRenewalDecision.RENEW) {
				await this.placementControl.renewLease(manager, sandbox, lease);
				return null;
			}
			const { leaseRenewalGraceDays } = await this.settings.get();
			const deadline = addMilliseconds(
				lease.priceLockedUntil,
				leaseRenewalGraceDays * MILLISECONDS_PER_DAY
			);
			lease.renewalState = LeaseRenewalState.RENEWAL_REQUIRED;
			lease.renewalDeadline = deadline;
			await manager.flush();
			return new SandboxLeaseRenewalRequiredEvent(sandbox, lease, deadline);
		});
		if (required) {
			this.eventEmitter.emit(SandboxEvents.LEASE_RENEWAL_REQUIRED, required);
		}
	}

	private async currentPrices(
		manager: EntityManager,
		lease: SandboxLease
	): Promise<LeaseRenewalPrices | null> {
		const listing = await manager.findOne(MachineListing, {
			machineId: lease.machineId,
		});
		if (!listing?.currentPriceCardId) return null;
		const card = await manager.findOneOrFail(MachinePriceCard, {
			id: listing.currentPriceCardId,
		});
		const { platformMarkupBasisPoints } = await this.settings.get();
		const terms = priceTerms(card, platformMarkupBasisPoints);
		return {
			hourlyGrossMicroUsd: runningHourlyPrice(terms, leaseShape(lease))
				.grossMicroUsd,
			egressGrossMicroUsdPerGiB: egressPricePerGiB(terms).grossMicroUsd,
		};
	}

	private async stopPastDeadline(now: Date): Promise<void> {
		const lapsed = await this.entityManager.find(
			SandboxLease,
			{
				endedAt: null,
				renewalState: LeaseRenewalState.RENEWAL_REQUIRED,
				renewalDeadline: { $lte: now },
			},
			{ fields: ['sandboxId'], limit: SANDBOX_LEASE_BATCH_SIZE }
		);
		const sandboxes = await this.entityManager.find(Sandbox, {
			id: { $in: lapsed.map(({ sandboxId }) => sandboxId) },
			state: SandboxState.STARTED,
			desiredState: SandboxDesiredState.STARTED,
			pending: false,
		});
		await settleSequentially(sandboxes, (sandbox) =>
			this.sandboxRepository
				.updateWhere(sandbox.id, {
					updateData: {
						pending: true,
						desiredState: SandboxDesiredState.STOPPED,
					},
					whereCondition: { pending: false, state: SandboxState.STARTED },
				})
				.catch((error: unknown) =>
					this.logger.error(
						`Could not stop sandbox ${sandbox.id} after its lease renewal deadline`,
						error
					)
				)
		);
	}
}
