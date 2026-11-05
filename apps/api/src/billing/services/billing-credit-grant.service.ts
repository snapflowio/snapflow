/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Organization } from '../../organization/entities/organization.entity';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../constants/billing.constants';
import type { AdminCreditGrantDto } from '../dto/billing-credit-grant.dto';
import { ledgerBalance } from '../queries/ledger-balance.query';
import {
	customerCreditAccount,
	platformAccount,
} from '../utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../utils/ledger/ledger-posting-builder.util';
import { BillingLedgerService } from './billing-ledger.service';

export interface BillingCreditGrantInput {
	organizationId: string;
	amountMicroUsd: number;
	reason: string;
	actorUserId: string;
}

@Injectable()
export class BillingCreditGrantService {
	constructor(private readonly ledger: BillingLedgerService) {}

	async grant(
		manager: EntityManager,
		input: BillingCreditGrantInput
	): Promise<AdminCreditGrantDto> {
		const organization = await manager.findOne(
			Organization,
			{ id: input.organizationId },
			{ fields: ['id'] }
		);
		if (!organization) {
			throw new NotFoundException(
				`Organization ${input.organizationId} not found`
			);
		}
		const grantId = randomUUID();
		const amount = MicroUsd.of(BigInt(input.amountMicroUsd));
		const reason = input.reason.trim();
		const customer = customerCreditAccount(organization.id);
		const transaction = await this.ledger.post(
			manager,
			LedgerPostingBuilder.for({
				sourceType: BillingLedgerSourceType.ADMIN_CREDIT_GRANT,
				descriptionCode: BillingLedgerDescriptionCode.ADMIN_CREDIT_GRANTED,
				sourceReference: grantId,
				effectiveAt: await databaseNow(manager),
				metadata: { reason, actorUserId: input.actorUserId },
			})
				.debit(
					platformAccount(BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS),
					amount
				)
				.credit(customer, amount)
				.build()
		);
		await manager.flush();
		return {
			grantId,
			transactionId: transaction.id,
			organizationId: organization.id,
			amountMicroUsd: amount.toString(),
			reason,
			creditBalanceMicroUsd: (
				await ledgerBalance(manager, customer)
			).toString(),
			grantedAt: transaction.postedAt,
		};
	}
}
