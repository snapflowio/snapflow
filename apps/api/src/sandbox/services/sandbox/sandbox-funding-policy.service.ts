/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { PlacementFundingState } from '../../../billing/constants/billing.constants';
import { BILLING_POLICY } from '../../../billing/constants/billing-policy.constants';
import { PlacementBillingAuthorization } from '../../../billing/entities/placement-billing-authorization.entity';
import { PlacementBillingAuthorizationService } from '../../../billing/services/placement/placement-billing-authorization.service';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { SandboxLifecycleService } from '../lifecycle/sandbox-lifecycle.service';

const RESERVATION_RENEWAL_BATCH_SIZE = 100;
const RENEWAL_LEAD_TIME_DIVISOR = 2;
const NO_RESERVATION_MICRO_USD = '0';

@Injectable()
export class SandboxFundingPolicyService {
	private readonly logger = new Logger(SandboxFundingPolicyService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly billingAuthorizations: PlacementBillingAuthorizationService,
		private readonly sandboxLifecycle: SandboxLifecycleService
	) {}

	async renewReservations(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.renewReservationsInContext()
		);
	}

	private async renewReservationsInContext(): Promise<void> {
		const observedAt = new Date();
		const renewalLeadMilliseconds = Math.max(
			MILLISECONDS_PER_MINUTE,
			Math.floor(
				(BILLING_POLICY.reservationRenewalMinutes * MILLISECONDS_PER_MINUTE) /
					RENEWAL_LEAD_TIME_DIVISOR
			)
		);
		const candidates = await this.entityManager.find(
			PlacementBillingAuthorization,
			{
				releasedAt: null,
				remainingReservedMicroUsd: { $gt: NO_RESERVATION_MICRO_USD },
				expiresAt: {
					$lte: addMilliseconds(observedAt, renewalLeadMilliseconds),
				},
			},
			{
				orderBy: { expiresAt: 'ASC' },
				limit: RESERVATION_RENEWAL_BATCH_SIZE,
			}
		);

		for (const candidate of candidates) {
			await this.renewCandidate(candidate, observedAt);
		}
	}

	private async renewCandidate(
		candidate: PlacementBillingAuthorization,
		observedAt: Date
	): Promise<void> {
		try {
			const renewed = await this.entityManager.transactional(
				async (manager) => {
					const placement = await manager.findOne(SandboxPlacement, {
						id: candidate.placementId,
					});
					const sandbox = await manager.findOne(Sandbox, {
						id: candidate.sandboxId,
					});
					const machine = placement
						? await manager.findOne(Machine, { id: placement.machineId })
						: null;
					if (!placement || !sandbox || !machine || placement.releasedAt) {
						await this.billingAuthorizations.clearReservation(
							manager,
							candidate.placementId
						);
						return false;
					}
					if (
						sandbox.state !== SandboxState.STARTED ||
						sandbox.desiredState !== SandboxDesiredState.STARTED
					) {
						await this.billingAuthorizations.clearReservation(
							manager,
							candidate.placementId
						);
						return false;
					}
					await this.billingAuthorizations.renew(
						manager,
						placement,
						sandbox,
						machine
					);
					return true;
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
			if (renewed) {
				this.logger.debug(
					`Renewed billing reservation for placement ${candidate.placementId}`
				);
			}
		} catch (error) {
			if (candidate.expiresAt.getTime() > observedAt.getTime()) {
				const graceStartsAt = addMilliseconds(
					candidate.expiresAt,
					-BILLING_POLICY.suspensionGraceMinutes * MILLISECONDS_PER_MINUTE
				);
				await this.entityManager.transactional(
					(manager) =>
						this.billingAuthorizations.markFundingState(
							manager,
							candidate.placementId,
							observedAt >= graceStartsAt
								? PlacementFundingState.SUSPENSION_PENDING
								: PlacementFundingState.WARNING
						),
					{ propagation: TransactionPropagation.REQUIRED }
				);
				this.logger.warn(
					`Billing reservation renewal deferred for placement ${candidate.placementId}: ${errorMessage(error)}`
				);
				return;
			}
			await this.stopExpiredPlacement(candidate, error);
		}
	}

	private async stopExpiredPlacement(
		candidate: PlacementBillingAuthorization,
		renewalError: unknown
	): Promise<void> {
		try {
			await this.entityManager.transactional(
				(manager) =>
					this.billingAuthorizations.markFundingState(
						manager,
						candidate.placementId,
						PlacementFundingState.SUSPENSION_PENDING
					),
				{ propagation: TransactionPropagation.REQUIRED }
			);
			await this.sandboxLifecycle.stop(
				candidate.sandboxId,
				candidate.customerOrganizationId
			);
			await this.entityManager.transactional(
				async (manager) => {
					await this.billingAuthorizations.clearReservation(
						manager,
						candidate.placementId
					);
					await this.billingAuthorizations.markFundingState(
						manager,
						candidate.placementId,
						PlacementFundingState.SUSPENDED,
						new Date()
					);
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
			this.logger.warn(
				`Stopped sandbox ${candidate.sandboxId} after its billing reservation expired: ${errorMessage(renewalError)}`
			);
		} catch (stopError) {
			this.logger.error(
				`Failed to stop sandbox ${candidate.sandboxId} after billing reservation expiry: ${errorMessage(stopError)}`
			);
		}
	}
}
