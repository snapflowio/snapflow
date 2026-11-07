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
import { PrivatePoolBillingService } from '../../../billing/services/private-pool-billing.service';
import { utcBillingMonth } from '../../../billing/utils/billing-period.util';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { PLATFORM_SERVICE_BILLER } from '../../constants/payment-channel.constants';
import {
	type UnbilledServicePeriod,
	unbilledServicePeriods,
} from '../../queries/unbilled-service-periods.query';
import { PaymentChannelService } from '../../services/payment-channel.service';
import { configuredEscrow } from '../../utils/escrow-identity.util';

// Charges the private pools for the current day, then opens the platform
// service channel of every month that owes fees and has none yet; the
// voucher issuer and claim relayer take it from there like any channel.
@Injectable()
export class PlatformServiceBillerService extends TrackedJobs {
	protected readonly logger = new Logger(PlatformServiceBillerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly locks: RedisLockProvider,
		private readonly privatePools: PrivatePoolBillingService,
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
					.transactional((manager) =>
						this.privatePools.chargeCurrentDay(manager)
					);
				const unbilled = await unbilledServicePeriods(
					this.entityManager.fork(),
					configuredEscrow(this.config)
				);
				for (const period of unbilled) await this.open(period);
			}
		);
	}

	// One organization's failure, such as an unreachable chain, is logged and
	// retried on the next run without holding back the others.
	private async open(period: UnbilledServicePeriod): Promise<void> {
		try {
			await this.entityManager
				.fork()
				.transactional((manager) =>
					this.channels.openPlatformService(
						manager,
						period.organizationId,
						utcBillingMonth(period.periodStart)
					)
				);
		} catch (error) {
			this.logger.error(
				`Opening the platform service channel of organization ${period.organizationId} for ${period.periodStart.toISOString()} failed`,
				error
			);
		}
	}
}
