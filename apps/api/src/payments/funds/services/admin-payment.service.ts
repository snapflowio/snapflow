/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import {
	AdminPaymentDisputeDto,
	type AdminPaymentDisputePageDto,
	type ListAdminPaymentDisputesQueryDto,
} from '../dto/admin-payment.dto';
import type { PaymentAccount } from '../entities/payment-account.entity';
import { PaymentDispute } from '../entities/payment-dispute.entity';
import { PaymentAccountService } from './payment-account.service';

@Injectable()
export class AdminPaymentService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly accounts: PaymentAccountService
	) {}

	async listDisputes(
		query: ListAdminPaymentDisputesQueryDto
	): Promise<AdminPaymentDisputePageDto> {
		const page = await findCursorPage(
			this.entityManager.fork(),
			PaymentDispute,
			{
				where: query.state ? { state: query.state } : {},
				orderBy: { createdAt: 'DESC', id: 'DESC' },
				limit: query.limit,
				cursor: query.cursor,
			}
		);
		return {
			items: page.items.map((dispute) => AdminPaymentDisputeDto.from(dispute)),
			nextCursor: page.nextCursor,
		};
	}

	account(organizationId: string): Promise<PaymentAccount> {
		return this.accounts.findOrFail(organizationId);
	}
}
