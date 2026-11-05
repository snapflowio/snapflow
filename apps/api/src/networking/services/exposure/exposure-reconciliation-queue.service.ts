/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { errorMessage } from '../../../common/utils/error/error.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { TransactionCommitHooks } from '../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { EXPOSURE_OBSERVED_STATE } from '../../constants/exposure.constants';
import {
	NETWORKING_LIMITS,
	NETWORKING_RECONCILIATION,
} from '../../constants/networking.constants';
import { NetworkingEvents } from '../../constants/networking-events.constants';
import { ExposureReconciliation } from '../../entities/exposure-reconciliation.entity';
import { lockExposures } from '../../utils/network-lock.util';

export interface ExposureReconciliationClaim {
	exposureId: string;
	requestedGeneration: number;
	claimToken: string;
}

@Injectable()
export class ExposureReconciliationQueueService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly events: EventEmitter2,
		private readonly commitHooks: TransactionCommitHooks
	) {}

	async enqueue(
		manager: EntityManager,
		exposureId: string,
		requestedGeneration: number
	): Promise<void> {
		await manager.execute(
			`INSERT INTO "sandbox_exposure_reconciliation"
				("exposureId", "requestedGeneration", "attempt", "availableAt", "claimToken", "claimExpiresAt", "lastError")
			 VALUES (?, ?, 0, transaction_timestamp(), NULL, NULL, NULL)
			 ON CONFLICT ("exposureId") DO UPDATE SET
				"requestedGeneration" = GREATEST("sandbox_exposure_reconciliation"."requestedGeneration", EXCLUDED."requestedGeneration"),
				"attempt" = 0,
				"availableAt" = transaction_timestamp(),
				"claimToken" = NULL,
				"claimExpiresAt" = NULL,
				"lastError" = NULL,
				"updatedAt" = transaction_timestamp()`,
			[exposureId, requestedGeneration]
		);
		this.requestReconciliation(manager);
	}

	async wake(
		manager: EntityManager,
		exposureId: string,
		requestedGeneration: number
	): Promise<void> {
		await manager.execute(
			`INSERT INTO "sandbox_exposure_reconciliation"
				("exposureId", "requestedGeneration", "attempt", "availableAt", "claimToken", "claimExpiresAt", "lastError")
			 VALUES (?, ?, 0, transaction_timestamp(), NULL, NULL, NULL)
			 ON CONFLICT ("exposureId") DO UPDATE SET
				"requestedGeneration" = GREATEST("sandbox_exposure_reconciliation"."requestedGeneration", EXCLUDED."requestedGeneration"),
				"attempt" = 0,
				"availableAt" = transaction_timestamp(),
				"lastError" = NULL,
				"updatedAt" = transaction_timestamp()
			 WHERE "sandbox_exposure_reconciliation"."claimToken" IS NULL`,
			[exposureId, requestedGeneration]
		);
		this.requestReconciliation(manager);
	}

	private requestReconciliation(manager: EntityManager): void {
		this.commitHooks.runAfterCommit(manager, () => {
			this.events.emit(NetworkingEvents.EXPOSURE_RECONCILIATION_REQUESTED);
		});
	}

	async claim(): Promise<ExposureReconciliationClaim | null> {
		return this.entityManager.transactional(
			async (manager) => {
				const now = await databaseNow(manager);
				const work = await manager.findOne(
					ExposureReconciliation,
					{
						availableAt: { $lte: now },
						$or: [{ claimExpiresAt: null }, { claimExpiresAt: { $lte: now } }],
					},
					{
						lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE,
						orderBy: { availableAt: 'ASC', createdAt: 'ASC' },
					}
				);
				if (!work) return null;

				work.claimToken = randomUUID();
				work.claimExpiresAt = addMilliseconds(
					now,
					NETWORKING_RECONCILIATION.claimDurationMilliseconds
				);
				return {
					exposureId: work.exposureId,
					requestedGeneration: work.requestedGeneration,
					claimToken: work.claimToken,
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async complete(claim: ExposureReconciliationClaim): Promise<void> {
		await this.entityManager.nativeDelete(ExposureReconciliation, {
			exposureId: claim.exposureId,
			requestedGeneration: { $lte: claim.requestedGeneration },
			claimToken: claim.claimToken,
		});
	}

	async retry(
		claim: ExposureReconciliationClaim,
		error: unknown
	): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const [exposure] = await lockExposures(manager, [claim.exposureId]);
				const work = await manager.findOne(
					ExposureReconciliation,
					{
						exposureId: claim.exposureId,
						claimToken: claim.claimToken,
					},
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!work) return;
				const now = await databaseNow(manager);
				work.attempt += 1;
				const exponent = Math.min(
					work.attempt - 1,
					NETWORKING_RECONCILIATION.maximumRetryExponent
				);
				const delay = Math.min(
					NETWORKING_RECONCILIATION.baseRetryDelayMilliseconds * 2 ** exponent,
					NETWORKING_RECONCILIATION.maximumRetryDelayMilliseconds
				);
				work.availableAt = addMilliseconds(now, delay);
				work.claimToken = null;
				work.claimExpiresAt = null;
				work.lastError = this.truncatedError(error);
				if (exposure) {
					exposure.observedState = EXPOSURE_OBSERVED_STATE.DEGRADED;
					exposure.lastError = work.lastError;
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async defer(
		claim: ExposureReconciliationClaim,
		availableAt: Date
	): Promise<void> {
		await this.entityManager.nativeUpdate(
			ExposureReconciliation,
			{
				exposureId: claim.exposureId,
				claimToken: claim.claimToken,
			},
			{
				availableAt,
				claimToken: null,
				claimExpiresAt: null,
				lastError: null,
				updatedAt: new Date(),
			}
		);
	}

	async enqueueUnmaterialized(): Promise<void> {
		await this.entityManager.execute(
			`INSERT INTO "sandbox_exposure_reconciliation"
				("exposureId", "requestedGeneration", "attempt", "availableAt", "claimToken", "claimExpiresAt", "lastError")
				 SELECT exposure."id", exposure."generation", 0, transaction_timestamp(), NULL, NULL, NULL
				 FROM "sandbox_exposure" exposure
				 WHERE (exposure."desiredState" <> 'deleted' OR exposure."observedState" <> 'deleted')
				 AND NOT EXISTS (
				SELECT 1 FROM "sandbox_exposure_reconciliation" work
				WHERE work."exposureId" = exposure."id"
			 )
			 AND (
				exposure."desiredState" = 'deleting'
				OR NOT EXISTS (
					SELECT 1 FROM "sandbox_exposure_backend" backend
					WHERE backend."exposureId" = exposure."id"
					  AND backend."exposureGeneration" = exposure."generation"
					  AND backend."state" IN ('pending', 'active')
					  AND backend."leaseExpiresAt" > transaction_timestamp() + (? * interval '1 millisecond')
					  AND backend."machineSessionGeneration" = (
						SELECT machine."sessionGeneration"
						FROM "machine" machine
						WHERE machine."id" = backend."machineId"
					  )
				)
				OR EXISTS (
					SELECT 1 FROM "sandbox_exposure_backend" draining
					WHERE draining."exposureId" = exposure."id"
					  AND draining."state" = 'draining'
					  AND draining."drainDeadline" <= transaction_timestamp()
				)
			 )
			 ON CONFLICT ("exposureId") DO NOTHING`,
			[NETWORKING_RECONCILIATION.backendLeaseDurationMilliseconds / 2]
		);
	}

	private truncatedError(error: unknown): string {
		return errorMessage(error).slice(0, NETWORKING_LIMITS.maximumErrorLength);
	}
}
