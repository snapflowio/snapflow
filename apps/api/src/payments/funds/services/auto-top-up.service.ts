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
	BadRequestException,
	ConflictException,
	Injectable,
} from '@nestjs/common';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import {
	AutoTopUpSuspendedReason,
	PaymentsErrorCode,
} from '../constants/payments.constants';
import { AutoTopUpDto, type UpdateAutoTopUpDto } from '../dto/auto-top-up.dto';
import { AutoTopUpPolicy } from '../entities/auto-top-up-policy.entity';
import { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { PaymentMethodService } from './payment-method.service';

export interface AutoTopUpEditor {
	organizationId: string;
	userId: string;
}

@Injectable()
export class AutoTopUpService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly paymentMethods: PaymentMethodService
	) {}

	async get(organizationId: string): Promise<AutoTopUpDto> {
		const policy = await this.entityManager
			.fork()
			.findOne(AutoTopUpPolicy, { organizationId });
		if (policy) return AutoTopUpDto.from(policy);
		const { autoTopUpMinimumCents } = await this.settings.get();
		return AutoTopUpDto.unconfigured(autoTopUpMinimumCents);
	}

	async update(
		editor: AutoTopUpEditor,
		expectedVersion: number,
		input: UpdateAutoTopUpDto
	): Promise<AutoTopUpPolicy> {
		const { autoTopUpMinimumCents, topUpMaximumCents } =
			await this.settings.get();
		if (input.amountCents < autoTopUpMinimumCents) {
			throw new BadRequestException({
				code: PaymentsErrorCode.AUTO_TOP_UP_AMOUNT_TOO_LOW,
				message: `Automatic top-ups must buy at least ${autoTopUpMinimumCents} cents`,
			});
		}
		if (input.amountCents > topUpMaximumCents) {
			throw new BadRequestException({
				code: PaymentsErrorCode.AUTO_TOP_UP_AMOUNT_TOO_HIGH,
				message: `Automatic top-ups must buy at most ${topUpMaximumCents} cents`,
			});
		}
		return this.entityManager.fork().transactional(async (manager) => {
			const method = await this.paymentMethods.findActive(
				manager,
				editor.organizationId,
				input.paymentMethodId
			);
			const existing = await manager.findOne(
				AutoTopUpPolicy,
				{ organizationId: editor.organizationId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if ((existing?.version ?? 0) !== expectedVersion) {
				throw new ConflictException({
					code: PaymentsErrorCode.AUTO_TOP_UP_VERSION_CONFLICT,
					message: 'The automatic top-up changed before this request',
				});
			}
			const target = existing ?? new AutoTopUpPolicy();
			if (!existing) {
				target.organizationId = editor.organizationId;
				manager.persist(target);
			}
			target.enabled = input.enabled;
			target.thresholdCents = input.thresholdCents;
			target.amountCents = input.amountCents;
			target.paymentMethodId = method.id;
			target.suspendedReason = null;
			target.consecutiveFailures = 0;
			target.consentedAt = await databaseNow(manager);
			target.consentedBy = editor.userId;
			return target;
		});
	}

	async recordSuccess(manager: EntityManager, topUp: TopUp): Promise<void> {
		if (topUp.kind !== TopUpKind.AUTO) return;
		await manager.nativeUpdate(
			AutoTopUpPolicy,
			{ organizationId: topUp.organizationId },
			{ consecutiveFailures: 0 }
		);
		await manager.nativeUpdate(
			AutoTopUpPolicy,
			{
				organizationId: topUp.organizationId,
				suspendedReason: AutoTopUpSuspendedReason.AUTHENTICATION_REQUIRED,
			},
			{ suspendedReason: null }
		);
	}
}
