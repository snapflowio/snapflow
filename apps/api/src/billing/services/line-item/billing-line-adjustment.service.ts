/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Injectable,
} from '@nestjs/common';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import { apiError } from '../../../common/utils/error/api-error.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	BILLING_POLICY_VERSION,
	BillingAdjustmentKind,
	type BillingAdjustmentReasonCode,
	BillingEvidenceStatus,
} from '../../constants/billing.constants';
import { BillingLineAdjustment } from '../../entities/billing-line-adjustment.entity';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import { BillingErrorCode } from '../../enums/billing-error-code.enum';
import { billingLineAmounts } from '../../utils/line-item/billing-line-amount.util';

interface BillingLineCreditInput {
	actorId: string;
	amountMicroUsd: MicroUsd;
	explanation: string;
	reasonCode: BillingAdjustmentReasonCode;
}

@Injectable()
export class BillingLineAdjustmentService {
	async effectiveCharge(
		manager: EntityManager,
		line: BillingLineItem
	): Promise<MicroUsd> {
		const adjustments = await manager.find(BillingLineAdjustment, {
			lineItemId: line.id,
		});
		return MicroUsd.parse(
			billingLineAmounts(line, adjustments).effectiveMicroUsd
		);
	}

	async credit(
		manager: EntityManager,
		line: BillingLineItem,
		input: BillingLineCreditInput
	): Promise<MicroUsd> {
		const currentEffective = await this.effectiveCharge(manager, line);
		const evidenceDigest = createHash('sha256')
			.update(
				canonicalJson({
					schemaVersion: BILLING_POLICY_VERSION,
					lineItemId: line.id,
					reasonCode: input.reasonCode,
					amountMicroUsd: input.amountMicroUsd.toString(),
					actorId: input.actorId,
				})
			)
			.digest('hex');
		const existing = await manager.findOne(BillingLineAdjustment, {
			evidenceDigest,
		});
		if (existing) return currentEffective;
		if (line.evidenceStatus !== BillingEvidenceStatus.PENDING) {
			throw new ConflictException(
				apiError(
					BillingErrorCode.LINE_CHARGE_POSTED,
					'This billing line is already charged and cannot be adjusted. Issue a credit on a later billing line instead.'
				)
			);
		}
		if (!input.amountMicroUsd.isPositive()) {
			throw new BadRequestException(
				apiError(
					BillingErrorCode.CREDIT_INVALID,
					'The credit must be greater than zero. Enter a positive amount.'
				)
			);
		}
		if (input.amountMicroUsd.greaterThan(currentEffective)) {
			throw new BadRequestException(
				apiError(
					BillingErrorCode.CREDIT_INVALID,
					'The credit is larger than the charge of this billing line. Enter an amount up to the charge.'
				)
			);
		}
		manager.persist(
			manager.create(BillingLineAdjustment, {
				id: randomUUID(),
				lineItemId: line.id,
				kind: BillingAdjustmentKind.CREDIT,
				amountMicroUsd: input.amountMicroUsd.toString(),
				reasonCode: input.reasonCode,
				explanation: input.explanation.trim(),
				actorId: input.actorId,
				evidenceDigest,
				policyVersion: BILLING_POLICY_VERSION,
				createdAt: await databaseNow(manager),
			})
		);
		return currentEffective.subtract(input.amountMicroUsd);
	}
}
