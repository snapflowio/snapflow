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
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import { NETWORK_METER_REVIEW_KINDS } from '../constants/network-meter-audit.constants';
import {
	type ListVerificationReviewsQueryDto,
	type ResolveVerificationReviewDto,
	VerificationReviewDto,
	type VerificationReviewPageDto,
} from '../dto/verification-review.dto';
import { VerificationReview } from '../entities/verification-review.entity';
import { VerificationErrorCode } from '../enums/verification-error-code.enum';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';
import { VerificationReviewState } from '../enums/verification-review-state.enum';
import { verificationReviewFilter } from '../queries/admin-verification.query';
import {
	lastVerifiedPassAt,
	machineChargesSince,
} from '../queries/verification.query';

@Injectable()
export class VerificationReviewService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService
	) {}

	async open(
		manager: EntityManager,
		machineId: string,
		kind: VerificationReviewKind,
		referenceId: string
	): Promise<VerificationReview> {
		const existing = await manager.findOne(VerificationReview, {
			machineId,
			kind,
			referenceId,
		});
		if (existing) return existing;
		const review = manager.create(VerificationReview, {
			machineId,
			kind,
			referenceId,
			state: VerificationReviewState.OPEN,
			openedAt: await databaseNow(manager),
		});
		manager.persist(review);
		return review;
	}

	async list(
		query: ListVerificationReviewsQueryDto
	): Promise<VerificationReviewPageDto> {
		const page = await findCursorPage(this.entityManager, VerificationReview, {
			where: verificationReviewFilter(query),
			orderBy: { openedAt: 'DESC', id: 'DESC' },
			limit: query.limit,
			cursor: query.cursor,
		});
		return { ...page, items: page.items.map(VerificationReviewDto.from) };
	}

	resolve(
		reviewId: string,
		input: ResolveVerificationReviewDto,
		adminUserId: string
	): Promise<VerificationReview> {
		return this.entityManager.transactional(async (manager) => {
			const review = await manager.findOne(
				VerificationReview,
				{ id: reviewId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!review) {
				throw new NotFoundException(
					apiError(
						VerificationErrorCode.REVIEW_NOT_FOUND,
						'The verification review was not found. Reload the review queue and try again.'
					)
				);
			}
			if (review.state !== VerificationReviewState.OPEN) {
				throw new ConflictException({
					code: VerificationErrorCode.REVIEW_NOT_OPEN,
					message:
						'The verification review is already resolved. Reload the review queue to see its outcome.',
				});
			}
			const now = await databaseNow(manager);
			if (input.outcome === VerificationReviewState.CLEARED) {
				await this.clear(manager, review);
			} else {
				await this.machines.restrict(manager, review.machineId, review.kind);
			}
			if (input.outcome === VerificationReviewState.FORFEITED) {
				await this.forfeit(manager, review);
			}
			if (input.outcome === VerificationReviewState.DELISTED) {
				await this.delist(manager, review.machineId, input.reason);
			}
			review.state = input.outcome;
			review.resolvedAt = now;
			review.resolvedBy = adminUserId;
			review.resolutionReason = input.reason;
			await manager.flush();
			return review;
		});
	}

	private async clear(
		manager: EntityManager,
		review: VerificationReview
	): Promise<void> {
		const machine = await this.lockMachine(manager, review.machineId);
		if (review.kind === VerificationReviewKind.FINGERPRINT_CONFLICT) {
			machine.fingerprintConflict = false;
		}
		const otherOpen = await manager.count(VerificationReview, {
			machineId: review.machineId,
			state: VerificationReviewState.OPEN,
			id: { $ne: review.id },
		});
		if (otherOpen === 0) {
			machine.restrictedAt = null;
			machine.restrictionReason = null;
		}
	}

	private async forfeit(
		manager: EntityManager,
		review: VerificationReview
	): Promise<void> {
		if (NETWORK_METER_REVIEW_KINDS.has(review.kind)) return;
		const since = await lastVerifiedPassAt(
			manager,
			review.machineId,
			review.openedAt
		);
		const charged = await machineChargesSince(manager, review.machineId, since);
		review.forfeitedMicroUsd = charged.toString();
	}

	private async delist(
		manager: EntityManager,
		machineId: string,
		reason: string
	): Promise<void> {
		const machine = await this.lockMachine(manager, machineId);
		machine.adminTierCap = MachineTier.PRIVATE;
		machine.adminTierCapReason = reason;
	}

	private lockMachine(
		manager: EntityManager,
		machineId: string
	): Promise<Machine> {
		return manager.findOneOrFail(
			Machine,
			{ id: machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
	}
}
