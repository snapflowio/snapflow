/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { addMilliseconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import {
	PAYMENT_VELOCITY_WINDOW,
	PaymentSuspensionReason,
} from '../constants/payments.constants';
import { PaymentMethod } from '../entities/payment-method.entity';
import { TopUp } from '../entities/top-up.entity';
import { fingerprintOrganizations } from '../queries/payment-velocity.query';
import {
	organizationsBeyondFingerprintLimit,
	topUpVelocityViolation,
} from '../utils/payment-velocity.util';
import { PaymentSuspensionService } from './payment-suspension.service';

@Injectable()
export class PaymentVelocityService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly suspensions: PaymentSuspensionService
	) {}

	async assertTopUpAllowed(
		manager: EntityManager,
		organizationId: string
	): Promise<void> {
		const settings = await this.settings.get();
		const now = await databaseNow(manager);
		const violation = topUpVelocityViolation(
			{
				topUpAttemptsLastHour: await manager.count(TopUp, {
					organizationId,
					createdAt: {
						$gte: this.since(
							now,
							PAYMENT_VELOCITY_WINDOW.topUpAttemptsMilliseconds
						),
					},
				}),
				paymentMethodsLastDay: await manager.count(PaymentMethod, {
					organizationId,
					createdAt: {
						$gte: this.since(
							now,
							PAYMENT_VELOCITY_WINDOW.paymentMethodsMilliseconds
						),
					},
				}),
			},
			settings
		);
		if (violation) {
			throw new HttpException(
				{
					code: violation,
					message: 'Too many payment attempts; try again later',
				},
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
	}

	async enforceCardFingerprint(cardFingerprint: string): Promise<void> {
		const { organizationsPerCardFingerprint } = await this.settings.get();
		const organizations = await fingerprintOrganizations(
			this.entityManager.fork(),
			cardFingerprint
		);
		const breaching = organizationsBeyondFingerprintLimit(
			organizations,
			organizationsPerCardFingerprint
		);
		for (const organizationId of breaching) {
			await this.suspensions.suspend(
				organizationId,
				PaymentSuspensionReason.SHARED_CARD,
				{ cardFingerprint }
			);
		}
	}

	private since(now: Date, windowMilliseconds: number): Date {
		return addMilliseconds(now, -windowMilliseconds);
	}
}
