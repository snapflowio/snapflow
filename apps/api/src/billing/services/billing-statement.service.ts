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
import { BadRequestException, Injectable } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { BillingStatementErrorCode } from '../constants/billing-statement.constants';
import type {
	BillingStatementDto,
	BillingStatementSummaryDto,
} from '../dto/billing-statement.dto';
import {
	customerCreditBefore,
	firstLedgerActivity,
	statementTotals,
	statementUsageBySandbox,
} from '../queries/billing-statement.query';
import {
	customerStatement,
	hostStatement,
	parseStatementMonth,
	statementPeriods,
	statementSummary,
} from '../utils/billing-statement.util';

@Injectable()
export class BillingStatementService {
	constructor(private readonly entityManager: EntityManager) {}

	list(organizationId: string): Promise<BillingStatementSummaryDto[]> {
		return this.entityManager.fork().transactional(
			async (manager) => {
				const now = await databaseNow(manager);
				const first = await firstLedgerActivity(manager, organizationId);
				return statementPeriods(first, now).map((period) =>
					statementSummary(period, now)
				);
			},
			{ readOnly: true }
		);
	}

	get(organizationId: string, month: string): Promise<BillingStatementDto> {
		const period = parseStatementMonth(month);
		if (!period) {
			throw new BadRequestException({
				code: BillingStatementErrorCode.MONTH_INVALID,
				message: 'The statement month must be formatted as YYYY-MM',
			});
		}
		return this.entityManager.fork().transactional(
			async (manager) => {
				const now = await databaseNow(manager);
				const { periodStart, periodEnd } = period;
				const totals = await statementTotals(
					manager,
					organizationId,
					periodStart,
					periodEnd
				);
				return {
					...statementSummary(period, now),
					customer: customerStatement({
						totals,
						openingCreditMicroUsd: await customerCreditBefore(
							manager,
							organizationId,
							periodStart
						),
						usageBySandbox: await statementUsageBySandbox(
							manager,
							organizationId,
							periodStart,
							periodEnd
						),
					}),
					host: hostStatement(totals),
				};
			},
			{ isolationLevel: IsolationLevel.REPEATABLE_READ, readOnly: true }
		);
	}
}
