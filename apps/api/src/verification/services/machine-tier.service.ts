/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_DAY } from '../../common/constants/time.constants';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { addDays, millisecondsBetween } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineAssessment } from '../../machine/entities/machine-assessment.entity';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import { SettingsService } from '../../settings/services/settings.service';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { PayoutReadiness } from '../../settlement/enums/payout-readiness.enum';
import { PayoutReadinessService } from '../../settlement/services/payout-readiness.service';
import { MACHINE_TIER_POLICY } from '../constants/machine-tier.constants';
import {
	AdminListingDto,
	type AdminListingPageDto,
	type ListAdminListingsQueryDto,
	type UpdateAdminMachineTierDto,
} from '../dto/admin-machine-tier.dto';
import {
	MachineBenchmarkDto,
	type MachineVerificationDto,
} from '../dto/machine-verification.dto';
import { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { SpotCheckState } from '../enums/spot-check-state.enum';
import { benchmarkStanding } from '../utils/benchmark-integrity.util';
import {
	diskMinimumMet,
	evaluateMachineTier,
	networkMinimumMet,
	type TierEvaluation,
	type TierEvaluationInput,
} from '../utils/tier-evaluation.util';

interface TierFacts {
	input: TierEvaluationInput;
	latestBenchmark: MachineBenchmark | null;
}

@Injectable()
export class MachineTierService extends TrackedJobs {
	protected readonly logger = new Logger(MachineTierService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService,
		private readonly settings: SettingsService,
		private readonly payoutReadiness: PayoutReadinessService
	) {
		super();
	}

	@TrackJobExecution()
	async evaluateAll(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const settings = await this.settings.get();
			let cursor: string | null = null;
			for (;;) {
				const batch: Machine[] = await this.entityManager.find(
					Machine,
					cursor ? { id: { $gt: cursor } } : {},
					{
						orderBy: { id: 'ASC' },
						limit: MACHINE_TIER_POLICY.BATCH_SIZE,
					}
				);
				await this.evaluateBatch(batch, settings);
				if (batch.length < MACHINE_TIER_POLICY.BATCH_SIZE) return;
				cursor = batch[batch.length - 1].id;
			}
		});
	}

	private async evaluateBatch(
		batch: readonly Machine[],
		settings: SettingsSnapshot
	): Promise<void> {
		for (const machine of batch) {
			try {
				await this.reevaluate(machine.id, settings);
			} catch (error) {
				this.logger.error(
					`Failed to evaluate the tier of machine ${machine.id}`,
					error
				);
			}
		}
	}

	async verification(
		organizationId: string,
		machineId: string
	): Promise<MachineVerificationDto> {
		const manager = this.entityManager.fork();
		const machine = await this.machines.findOwned(
			manager,
			organizationId,
			machineId
		);
		const settings = await this.settings.get();
		const facts = await this.facts(
			manager,
			machine,
			settings,
			await databaseNow(manager)
		);
		return {
			tier: machine.tier,
			reasons: machine.tierReasons,
			checklist: {
				payoutWallet: facts.input.payoutWalletReady,
				benchmark: facts.input.benchmarkPassed && facts.input.inventoryCurrent,
				fingerprintUnique: !facts.input.fingerprintConflict,
				networkMinimum: facts.input.networkMinimumMet,
				diskMinimum: facts.input.diskMinimumMet,
				listedDays: facts.input.listedDays,
				uptimeBasisPoints: facts.input.uptimeBasisPoints,
				spotChecksPassed30d: facts.input.spotChecksPassed,
			},
			latestBenchmark: facts.latestBenchmark
				? MachineBenchmarkDto.from(facts.latestBenchmark)
				: null,
		};
	}

	async listAdmin(
		query: ListAdminListingsQueryDto
	): Promise<AdminListingPageDto> {
		const page = await findCursorPage(this.entityManager, Machine, {
			where: query.tier ? { tier: query.tier } : {},
			orderBy: { id: 'ASC' },
			limit: query.limit,
			cursor: query.cursor,
		});
		return { ...page, items: page.items.map(AdminListingDto.from) };
	}

	async updateAdminTier(
		machineId: string,
		input: UpdateAdminMachineTierDto
	): Promise<Machine> {
		const settings = await this.settings.get();
		return this.entityManager.transactional(async (manager) => {
			const machine = await manager.findOneOrFail(
				Machine,
				{ id: machineId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			const now = await databaseNow(manager);
			if (input.tierCap !== undefined) {
				machine.adminTierCap = input.tierCap;
				machine.adminTierCapReason =
					input.tierCap === null ? null : input.reason;
			}
			if (input.datacenterApproved !== undefined) {
				machine.datacenterApprovedAt = input.datacenterApproved
					? (machine.datacenterApprovedAt ?? now)
					: null;
			}
			await manager.flush();
			await this.apply(manager, machine, settings, now);
			return machine;
		});
	}

	private reevaluate(
		machineId: string,
		settings: SettingsSnapshot
	): Promise<TierEvaluation> {
		return this.entityManager.transactional(async (manager) => {
			const machine = await manager.findOneOrFail(
				Machine,
				{ id: machineId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			return this.apply(manager, machine, settings, await databaseNow(manager));
		});
	}

	private async apply(
		manager: EntityManager,
		machine: Machine,
		settings: SettingsSnapshot,
		now: Date
	): Promise<TierEvaluation> {
		const facts = await this.facts(manager, machine, settings, now);
		const evaluation = evaluateMachineTier(facts.input, settings);
		if (
			evaluation.tier !== machine.tier ||
			evaluation.reasons.join() !== machine.tierReasons.join()
		) {
			await this.machines.setTier(
				manager,
				machine.id,
				evaluation.tier,
				evaluation.reasons
			);
		}
		return evaluation;
	}

	private async facts(
		manager: EntityManager,
		machine: Machine,
		settings: SettingsSnapshot,
		now: Date
	): Promise<TierFacts> {
		const windowStart = addDays(
			now,
			-MACHINE_TIER_POLICY.EVALUATION_WINDOW_DAYS
		);
		const [listing, payouts, latestBenchmark, assessment, passed, failed] =
			await Promise.all([
				manager.findOne(MachineListing, { machineId: machine.id }),
				this.payoutReadiness.forOrganization(machine.organizationId, manager),
				manager.findOne(
					MachineBenchmark,
					{
						machineId: machine.id,
						state: {
							$nin: [BenchmarkState.PENDING, BenchmarkState.NOT_ADMITTED],
						},
					},
					{ orderBy: { issuedAt: 'DESC' } }
				),
				manager.findOne(MachineAssessment, { machineId: machine.id }),
				this.countSpotChecks(
					manager,
					machine.id,
					SpotCheckState.PASSED,
					windowStart
				),
				this.countSpotChecks(
					manager,
					machine.id,
					SpotCheckState.FAILED,
					windowStart
				),
			]);
		return {
			latestBenchmark,
			input: {
				listingPublic: listing?.visibility === ListingVisibility.PUBLIC,
				payoutWalletReady: payouts === PayoutReadiness.READY,
				benchmarkPassed: benchmarkStanding(
					machine.latestBenchmarkId,
					latestBenchmark
				),
				inventoryCurrent:
					machine.inventoryDigest !== null &&
					machine.inventoryDigest === machine.benchmarkedInventoryDigest,
				fingerprintConflict: machine.fingerprintConflict,
				networkMinimumMet: networkMinimumMet(machine, settings),
				diskMinimumMet: diskMinimumMet(machine, settings),
				restricted: machine.restrictedAt !== null,
				listedDays: machine.listedSince
					? Math.floor(
							millisecondsBetween(machine.listedSince, now) /
								MILLISECONDS_PER_DAY
						)
					: 0,
				uptimeBasisPoints: assessment?.uptimeBasisPoints ?? 0,
				spotChecksPassed: passed,
				spotChecksFailed: failed,
				datacenterApproved: machine.datacenterApprovedAt !== null,
				adminTierCap: machine.adminTierCap,
			},
		};
	}

	private countSpotChecks(
		manager: EntityManager,
		machineId: string,
		state: SpotCheckState,
		since: Date
	): Promise<number> {
		return manager.count(MachineSpotCheck, {
			machineId,
			state,
			completedAt: { $gte: since },
		});
	}
}
