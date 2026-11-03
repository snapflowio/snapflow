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
import { OnEvent } from '@nestjs/event-emitter';
import { CoalescingRunner } from '../../../../common/utils/concurrency/coalescing-runner.util';
import { NETWORKING_RECONCILIATION } from '../../constants/networking.constants';
import { NetworkingEvents } from '../../constants/networking-events.constants';
import { ExposureMaterializerService } from './exposure-materializer.service';
import {
	type ExposureReconciliationClaim,
	ExposureReconciliationQueueService,
} from './exposure-reconciliation-queue.service';

@Injectable()
export class ExposureReconciliationWorkerService {
	private readonly logger = new Logger(
		ExposureReconciliationWorkerService.name
	);
	private readonly drains = new CoalescingRunner(() =>
		RequestContext.create(this.entityManager, () => this.drainQueue())
	);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly queue: ExposureReconciliationQueueService,
		private readonly materializer: ExposureMaterializerService
	) {}

	async run(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.queue.enqueueUnmaterialized()
		);
		await this.drains.run();
	}

	@OnEvent(NetworkingEvents.EXPOSURE_RECONCILIATION_REQUESTED)
	handleReconciliationRequested(): void {
		this.drains.run().catch((error: unknown) => {
			this.logger.warn(
				`Exposure reconciliation drain failed: ${this.errorDetail(error)}`
			);
		});
	}

	private async drainQueue(): Promise<void> {
		for (
			let processed = 0;
			processed < NETWORKING_RECONCILIATION.claimBatchSize;
			processed += 1
		) {
			const claim = await this.queue.claim();
			if (!claim) return;
			await this.process(claim);
		}
	}

	private async process(claim: ExposureReconciliationClaim): Promise<void> {
		try {
			const retryAt = await this.materializer.reconcile(claim.exposureId);
			if (retryAt) {
				await this.queue.defer(claim, retryAt);
			} else {
				await this.queue.complete(claim);
			}
		} catch (error: unknown) {
			this.logger.warn(
				`Exposure ${claim.exposureId} reconciliation failed: ${this.errorDetail(error)}`
			);
			await this.queue.retry(claim, error);
		}
	}

	private errorDetail(error: unknown): string {
		return error instanceof Error
			? (error.stack ?? error.message)
			: String(error);
	}
}
