/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { addSeconds } from '../../../common/utils/time.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SettingsService } from '../../../settings/services/settings.service';
import { VOUCHER_ISSUER } from '../../constants/payment-channel.constants';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { PaymentChannelState } from '../../enums/payment-channel-state.enum';
import {
	VoucherIssuanceService,
	type VoucherSettings,
} from '../../services/voucher-issuance.service';

// Evaluates every channel whose voucher interval has passed, each in its
// own transaction, so one failing lease never holds back the others.
@Injectable()
export class VoucherIssuerService extends TrackedJobs {
	protected readonly logger = new Logger(VoucherIssuerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly locks: RedisLockProvider,
		private readonly issuance: VoucherIssuanceService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(VOUCHER_ISSUER.JOB)
	@CreateRequestContext()
	async issueDueVouchers(): Promise<void> {
		await this.locks.runExclusive(
			VOUCHER_ISSUER.JOB,
			VOUCHER_ISSUER.LOCK_TTL_SECONDS,
			async () => {
				const settings = await this.settings.get();
				const manager = this.entityManager.fork();
				const due = await manager.find(
					PaymentChannel,
					{
						state: { $ne: PaymentChannelState.CLOSED },
						nextIssueAt: { $lte: await databaseNow(manager) },
					},
					{
						fields: ['id'],
						orderBy: { nextIssueAt: QueryOrder.ASC },
						limit: VOUCHER_ISSUER.BATCH_SIZE,
					}
				);
				for (const { id } of due) await this.evaluate(id, settings);
			}
		);
	}

	// A failed evaluation is logged and retried an interval later rather
	// than on every run.
	private async evaluate(
		paymentChannelId: string,
		settings: VoucherSettings
	): Promise<void> {
		try {
			await this.entityManager
				.fork()
				.transactional((manager) =>
					this.issuance.evaluate(manager, paymentChannelId, settings)
				);
		} catch (error) {
			this.logger.error(
				`Issuing vouchers for payment channel ${paymentChannelId} failed; retrying in ${settings.voucherIntervalSeconds}s`,
				error
			);
			const manager = this.entityManager.fork();
			await manager.nativeUpdate(
				PaymentChannel,
				{ id: paymentChannelId },
				{
					nextIssueAt: addSeconds(
						await databaseNow(manager),
						settings.voucherIntervalSeconds
					),
				}
			);
		}
	}
}
