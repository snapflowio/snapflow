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
import {
	priceShape,
	recordedPriceTerms,
	repricedHourlyGross,
} from '../../billing/utils/placement-pricing.util';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { addDays, addMilliseconds } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { CommittedEventPublisher } from '../../infra/database/services/committed-event-publisher.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import { runningHourlyPrice } from '../../marketplace/utils/pricing/pricing.util';
import { shapeFits } from '../../marketplace/utils/pricing/slice-pricing.util';
import { SandboxPlacementControlService } from '../../placement/services/sandbox-placement-control.service';
import { SettingsService } from '../../settings/services/settings.service';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import {
	SANDBOX_PRICE_BATCH_SIZE,
	SANDBOX_PRICE_JOB,
} from '../constants/sandbox-placement.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxPriceIncreaseScheduledEvent } from '../events/sandbox-price-increase-scheduled.event';
import { SandboxConflictException } from '../exceptions/sandbox-conflict.exception';
import { SandboxRepository } from '../repositories/sandbox.repository';
import {
	hasNewerCard,
	PriceChangeAction,
	priceChangeAction,
	repriceRetryDelayMilliseconds,
} from '../utils/price-change.util';

const PRICE_CHANGE_LOCK_TTL_SECONDS = 300;

const CHANGED_PRICES_SQL = `SELECT price.id
	FROM placement_price price
	JOIN machine_listing listing ON listing."machineId" = price."machineId"
	JOIN machine_price_card card ON card.id = listing."currentPriceCardId"
	JOIN sandbox ON sandbox.id = price."sandboxId"
	WHERE price."endedAt" IS NULL
	  AND price."priceCardId" IS NOT NULL
	  AND listing."currentPriceCardId" <> price."priceCardId"
	  AND (price."priceIncreaseAt" IS NULL
	    OR price."priceIncreaseAt" <= now()
	    OR price."priceIncreaseCardId" <> listing."currentPriceCardId"
	    OR sandbox.state <> ?)
	  AND (price."repriceRetryAt" IS NULL OR price."repriceRetryAt" <= now())
	  AND (price."wholeMachine"
	    OR (price.cpu <= card.vcpu AND price."memoryGib" <= card."memoryGib"
	      AND price.gpu <= card."gpuCount")
	    OR (sandbox.state = ? AND sandbox."desiredState" = ?))
	  AND (?::uuid IS NULL OR price.id > ?::uuid)
	ORDER BY price.id
	LIMIT ?`;

const UNFIT_STOP_REASON =
	"the machine was re-benchmarked with less capacity than the sandbox's shape; it keeps its disk and moves to a machine that fits on its next start";

interface PriceReview {
	placementPrice: PlacementPrice;
	sandbox: Sandbox;
	nextCard: MachinePriceCard;
	current: MicroUsd;
	next: MicroUsd;
	announced: MicroUsd | null;
	fits: boolean;
}

@Injectable()
export class SandboxPriceChangeManager extends TrackedJobs {
	protected readonly logger = new Logger(SandboxPriceChangeManager.name);
	private cursor: string | null = null;

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly placementControl: SandboxPlacementControlService,
		private readonly settings: SettingsService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly committedEvents: CommittedEventPublisher
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(SANDBOX_PRICE_JOB.PRICE_CHANGE)
	@CreateRequestContext()
	async applyPriceChanges(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			SANDBOX_PRICE_JOB.PRICE_CHANGE,
			PRICE_CHANGE_LOCK_TTL_SECONDS,
			async () => {
				const changed = await this.entityManager.execute<{ id: string }[]>(
					CHANGED_PRICES_SQL,
					[
						SandboxState.STARTED,
						SandboxState.STARTED,
						SandboxDesiredState.STARTED,
						this.cursor,
						this.cursor,
						SANDBOX_PRICE_BATCH_SIZE,
					]
				);
				this.cursor =
					changed.length < SANDBOX_PRICE_BATCH_SIZE
						? null
						: (changed.at(-1)?.id ?? null);
				await settleSequentially(changed, ({ id }) =>
					this.review(id).catch((error: unknown) => this.failed(id, error))
				);
			}
		);
	}

	async applyBeforeStart(sandboxId: string): Promise<void> {
		const manager = this.entityManager.fork();
		const placementPrice = await manager.findOne(PlacementPrice, {
			sandboxId,
			endedAt: null,
		});
		if (!placementPrice) return;
		const listing = await manager.findOne(MachineListing, {
			machineId: placementPrice.machineId,
		});
		if (
			listing &&
			hasNewerCard(placementPrice.priceCardId, listing.currentPriceCardId)
		) {
			await this.review(placementPrice.id);
		}
	}

	private async review(placementPriceId: string): Promise<void> {
		const event = await this.entityManager
			.fork()
			.transactional(async (manager) => {
				const review = await this.load(manager, placementPriceId);
				return review ? this.apply(manager, review) : null;
			});
		if (event) {
			this.committedEvents.publish(
				SandboxEvents.PRICE_INCREASE_SCHEDULED,
				event
			);
		}
	}

	private async apply(
		manager: EntityManager,
		review: PriceReview
	): Promise<SandboxPriceIncreaseScheduledEvent | null> {
		const { placementPrice, sandbox, nextCard } = review;
		const now = await databaseNow(manager);
		const action = priceChangeAction({
			running: sandbox.state === SandboxState.STARTED,
			fits: review.fits,
			current: review.current,
			next: review.next,
			announced: review.announced,
			increaseDue:
				placementPrice.priceIncreaseAt !== null &&
				placementPrice.priceIncreaseAt <= now,
			maximum: MicroUsd.parseNullable(sandbox.maxHourlyPriceMicroUsd),
		});
		switch (action) {
			case PriceChangeAction.REPRICE:
				await this.placementControl.repricePlacement(
					manager,
					sandbox,
					placementPrice
				);
				return null;
			case PriceChangeAction.ANNOUNCE:
				return this.announce(manager, review, now);
			case PriceChangeAction.WAIT:
				if (
					review.fits &&
					placementPrice.priceIncreaseCardId !== null &&
					placementPrice.priceIncreaseCardId !== nextCard.id
				) {
					placementPrice.priceIncreaseCardId = nextCard.id;
					await manager.flush();
				}
				return null;
			case PriceChangeAction.STOP_ABOVE_MAXIMUM:
				await this.stop(sandbox.id);
				return null;
			case PriceChangeAction.STOP_UNFIT:
				this.logger.warn(
					`Stopping sandbox ${sandbox.id}: ${UNFIT_STOP_REASON}`
				);
				await this.stop(sandbox.id);
				return null;
		}
	}

	private async announce(
		manager: EntityManager,
		review: PriceReview,
		now: Date
	): Promise<SandboxPriceIncreaseScheduledEvent> {
		const { placementPrice } = review;
		const { priceLockDays } = await this.settings.get();
		const priceIncreaseAt = addDays(now, priceLockDays);
		placementPrice.priceIncreaseAt = priceIncreaseAt;
		placementPrice.priceIncreaseCardId = review.nextCard.id;
		await manager.flush();
		return new SandboxPriceIncreaseScheduledEvent(
			review.sandbox,
			placementPrice.id,
			priceIncreaseAt,
			review.current,
			review.next
		);
	}

	private async load(
		manager: EntityManager,
		placementPriceId: string
	): Promise<PriceReview | null> {
		const placementPrice = await manager.findOne(
			PlacementPrice,
			{ id: placementPriceId, endedAt: null },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!placementPrice?.priceCardId) return null;
		const listing = await manager.findOneOrFail(MachineListing, {
			machineId: placementPrice.machineId,
		});
		if (!listing.currentPriceCardId) return null;
		const [sandbox, currentCard, nextCard, announcedCard] = await Promise.all([
			manager.findOneOrFail(Sandbox, { id: placementPrice.sandboxId }),
			manager.findOneOrFail(MachinePriceCard, {
				id: placementPrice.priceCardId,
			}),
			manager.findOneOrFail(MachinePriceCard, {
				id: listing.currentPriceCardId,
			}),
			placementPrice.priceIncreaseCardId
				? manager.findOneOrFail(MachinePriceCard, {
						id: placementPrice.priceIncreaseCardId,
					})
				: null,
		]);
		const shape = priceShape(placementPrice);
		const current = runningHourlyPrice(
			recordedPriceTerms(placementPrice, currentCard),
			shape
		).grossMicroUsd;
		const base = { placementPrice, sandbox, nextCard, current };
		if (!placementPrice.wholeMachine && !shapeFits(nextCard, shape)) {
			return { ...base, next: current, announced: null, fits: false };
		}
		const settings = await this.settings.get();
		return {
			...base,
			next: repricedHourlyGross(placementPrice, nextCard, settings),
			announced: announcedCard
				? repricedHourlyGross(placementPrice, announcedCard, settings)
				: null,
			fits: true,
		};
	}

	private async failed(
		placementPriceId: string,
		error: unknown
	): Promise<void> {
		this.logger.error(
			`Could not reprice placement price ${placementPriceId}`,
			error
		);
		await this.entityManager.fork().transactional(async (manager) => {
			const placementPrice = await manager.findOne(PlacementPrice, {
				id: placementPriceId,
				endedAt: null,
			});
			if (!placementPrice) return;
			placementPrice.repriceAttempts += 1;
			placementPrice.repriceRetryAt = addMilliseconds(
				await databaseNow(manager),
				repriceRetryDelayMilliseconds(placementPrice.repriceAttempts)
			);
		});
	}

	private async stop(sandboxId: string): Promise<void> {
		try {
			await this.sandboxRepository.updateWhere(sandboxId, {
				updateData: {
					pending: true,
					desiredState: SandboxDesiredState.STOPPED,
				},
				whereCondition: { pending: false, state: SandboxState.STARTED },
			});
		} catch (error) {
			if (!(error instanceof SandboxConflictException)) throw error;
		}
	}
}
