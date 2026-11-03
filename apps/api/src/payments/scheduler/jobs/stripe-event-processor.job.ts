/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { stripeErrorDetails } from '../../../common/utils/error/stripe-error.util';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import {
	PaymentsJob,
	STRIPE_EVENT_WAKE,
} from '../../funds/constants/payments.constants';
import { StripeEventProcessorService } from '../../funds/services/stripe-event/stripe-event-processor.service';

@Injectable()
export class StripeEventProcessorJob implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(StripeEventProcessorJob.name);
	#unsubscribe: (() => void) | null = null;

	constructor(
		private readonly stripeEventProcessorService: StripeEventProcessorService,
		private readonly wake: ControlWakeService,
		private readonly settings: SettingsService
	) {}

	onModuleInit(): void {
		this.#unsubscribe = this.wake.subscribe(
			STRIPE_EVENT_WAKE.topic,
			STRIPE_EVENT_WAKE.id,
			() => {
				this.processOnWake().catch((error: unknown) => {
					this.logger.error(
						`Stripe event processing failed: ${stripeErrorDetails(error)}`
					);
				});
			}
		);
	}

	onModuleDestroy(): void {
		this.#unsubscribe?.();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: PaymentsJob.PROCESS_STRIPE_EVENTS,
		waitForCompletion: true,
	})
	processPending(): Promise<void> {
		return this.stripeEventProcessorService.processPending();
	}

	private async processOnWake(): Promise<void> {
		const { maintenanceMode } = await this.settings.get();
		if (!maintenanceMode)
			await this.stripeEventProcessorService.processPending();
	}
}
