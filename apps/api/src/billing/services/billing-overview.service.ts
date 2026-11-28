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
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { AutomaticPaymentsService } from '../../settlement/services/vouchers/automatic-payments.service';
import { MINIMUM_BILLABLE_HOURLY_MICRO_USD } from '../constants/billing-admission.constants';
import type { BillingOverviewDto } from '../dto/billing.dto';
import { BillingBudget } from '../entities/billing-budget.entity';
import { OrganizationFunding } from '../entities/organization-funding.entity';
import { monthSpend } from '../queries/billing-admission.query';
import { dailyCosts } from '../queries/billing-overview.query';
import { customerCreditBalances } from '../queries/ledger-balance.query';
import { utcBillingMonth } from '../utils/billing-period.util';
import { unfundedArchivesDeleteAt } from '../utils/funding/runway.util';
import { billingOverview } from '../utils/reporting/billing-overview.util';
import { BillingRunwayService } from './billing-runway.service';

@Injectable()
export class BillingOverviewService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly runway: BillingRunwayService,
		private readonly automaticPayments: AutomaticPaymentsService
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
		const runway = await this.runway.runway(manager, organizationId);
		const state = await manager.findOne(OrganizationFunding, {
			organizationId,
		});
		return billingOverview({
			observedAt,
			month,
			budget: await manager.findOne(BillingBudget, { organizationId }),
			runway,
			startRequirement: this.runway.startRequirement(
				runway,
				MINIMUM_BILLABLE_HOURLY_MICRO_USD
			),
			state,
			archivesDeleteAt:
				state?.computeStoppedAt && !state.archivesDeletedAt
					? unfundedArchivesDeleteAt(state.computeStoppedAt)
					: null,
			monthSpend: await monthSpend(manager, organizationId, month.start),
			daily: await dailyCosts(manager, organizationId, month.start),
			automaticPayments: await this.automaticPayments.gap(
				manager,
				organizationId
			),
		});
	}
}
