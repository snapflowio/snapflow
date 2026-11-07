/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { IsolationLevel } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { escrowFunding } from '../../settlement/queries/escrow-funding.query';
import { configuredEscrow } from '../../settlement/utils/escrow-identity.util';
import type { BillingOverviewDto } from '../dto/billing.dto';
import { BillingBudget } from '../entities/billing-budget.entity';
import {
	monthSpend,
	unpostedCharges,
} from '../queries/billing-admission.query';
import {
	activeReservations,
	dailyCosts,
} from '../queries/billing-overview.query';
import {
	customerCreditBalances,
	ledgerBalance,
} from '../queries/ledger-balance.query';
import { liveAccrualByPlacement } from '../queries/live-accrual.query';
import { billingOverview } from '../utils/billing-overview.util';
import { utcBillingMonth } from '../utils/billing-period.util';
import { customerCreditAccount } from '../utils/ledger/billing-ledger-accounts.util';
import { BillingRunwayService } from './billing-runway.service';

@Injectable()
export class BillingOverviewService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly runway: BillingRunwayService,
		private readonly config: TypedConfigService
	) {}

	overview(organizationId: string): Promise<BillingOverviewDto> {
		return this.entityManager.transactional(
			(manager) => this.snapshot(manager, organizationId),
			{ isolationLevel: IsolationLevel.REPEATABLE_READ, readOnly: true }
		);
	}

	creditBalances(
		organizationIds: readonly string[]
	): Promise<Map<string, MicroUsd>> {
		return customerCreditBalances(this.entityManager, organizationIds);
	}

	private async snapshot(
		manager: EntityManager,
		organizationId: string
	): Promise<BillingOverviewDto> {
		const observedAt = await databaseNow(manager);
		const month = utcBillingMonth(observedAt);
		const budget = await manager.findOne(BillingBudget, { organizationId });
		const minimumRunwayMinutes = this.runway.minimumRunwayMinutes(budget);
		return billingOverview({
			observedAt,
			month,
			budget,
			creditBalance: await ledgerBalance(
				manager,
				customerCreditAccount(organizationId)
			),
			escrow: await escrowFunding(
				manager,
				configuredEscrow(this.config),
				organizationId
			),
			spend: await monthSpend(manager, organizationId, month.start),
			unposted: await unpostedCharges(manager, organizationId),
			reservations: await activeReservations(manager, organizationId),
			daily: await dailyCosts(manager, organizationId, month.start),
			liveAccrualByPlacementId: await liveAccrualByPlacement(
				manager,
				{ customerOrganizationId: organizationId, endAt: null },
				observedAt
			),
			minimumRunwayMinutes,
			networkReservation: await this.runway.networkReservation(
				manager,
				organizationId,
				minimumRunwayMinutes,
				observedAt
			),
		});
	}
}
