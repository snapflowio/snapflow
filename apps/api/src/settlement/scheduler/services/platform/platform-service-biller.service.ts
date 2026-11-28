/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { StorageBillingService } from '../../../../billing/services/storage-billing.service';
import { LogExecution } from '../../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { PLATFORM_SERVICE_BILLER } from '../../../constants/payment-channel.constants';
import {
	type PlatformServiceCharges,
	platformServiceCharges,
} from '../../../queries/platform-service-charges.query';
import { PaymentChannelService } from '../../../services/channels/payment-channel.service';

@Injectable()
export class PlatformServiceBillerService extends TrackedJobs {
	protected readonly logger = new Logger(PlatformServiceBillerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly locks: RedisLockProvider,
		private readonly storage: StorageBillingService,
		private readonly channels: PaymentChannelService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(PLATFORM_SERVICE_BILLER.JOB)
	@CreateRequestContext()
	async billPlatformServices(): Promise<void> {
		await this.locks.runExclusive(
			PLATFORM_SERVICE_BILLER.JOB,
			PLATFORM_SERVICE_BILLER.LOCK_TTL_SECONDS,
			async () => {
				await this.entityManager
					.fork()
					.transactional((manager) => this.storage.chargeDueHours(manager));
				const charges = await platformServiceCharges(this.entityManager.fork());
				for (const owed of charges) await this.record(owed);
			}
		);
	}

	private async record(owed: PlatformServiceCharges): Promise<void> {
		try {
			await this.entityManager
				.fork()
				.transactional(async (manager) =>
					this.channels.recordPlatformCharges(
						manager,
						owed.organizationId,
						owed.chargedMicroUsd,
						await databaseNow(manager)
					)
				);
		} catch (error) {
			this.logger.error(
				`Recording the platform charges of organization ${owed.organizationId} failed`,
				error
			);
		}
	}
}
