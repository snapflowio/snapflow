/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import {
	DEFAULT_BUDGET_MODE,
	DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
} from '../constants/billing.constants';
import { BillingBudgetErrorCode } from '../constants/billing-admission.constants';
import { BILLING_POLICY } from '../constants/billing-policy.constants';
import type {
	BillingBudgetDto,
	UpdateBillingBudgetDto,
} from '../dto/billing.dto';
import { BillingBudget } from '../entities/billing-budget.entity';
import { BillingBudgetVersion } from '../entities/billing-budget-version.entity';

const UNSAVED_BUDGET_VERSION = 0;

type BudgetEditor = Pick<OrganizationAuthContext, 'organizationId' | 'userId'>;

@Injectable()
export class BillingBudgetService {
	constructor(private readonly entityManager: EntityManager) {}

	async find(organizationId: string): Promise<BillingBudgetDto> {
		const budget = await this.entityManager.findOne(BillingBudget, {
			organizationId,
		});
		if (budget) return toDto(budget);
		return {
			resourceVersion: UNSAVED_BUDGET_VERSION,
			mode: DEFAULT_BUDGET_MODE,
			warningThresholdBasisPoints:
				DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
			desiredMinimumRunwayMinutes: BILLING_POLICY.minimumRunwayMinutes,
		};
	}

	async update(
		{ organizationId, userId }: BudgetEditor,
		expectedVersion: number,
		input: UpdateBillingBudgetDto
	): Promise<BillingBudgetDto> {
		assertPositive(input.monthlyLimitMicroUsd, 'Monthly budget');
		if (input.networkLimitMicroUsd !== undefined) {
			assertPositive(input.networkLimitMicroUsd, 'Network budget');
		}
		return this.entityManager.transactional(
			async (manager) => {
				const organization = await manager.findOne(
					Organization,
					{ id: organizationId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!organization) {
					throw new ConflictException({
						code: BillingBudgetErrorCode.ORGANIZATION_NOT_FOUND,
					});
				}
				const current = await manager.findOne(
					BillingBudget,
					{ organizationId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const currentVersion =
					current?.resourceVersion ?? UNSAVED_BUDGET_VERSION;
				if (currentVersion !== expectedVersion) {
					throw new ConflictException({
						code: BillingBudgetErrorCode.VERSION_CONFLICT,
						expectedVersion,
						currentVersion,
					});
				}
				const updatedAt = await databaseNow(manager);
				const budget =
					current ??
					manager.create(BillingBudget, {
						organizationId,
						resourceVersion: currentVersion + 1,
						monthlyLimitMicroUsd: input.monthlyLimitMicroUsd,
						networkLimitMicroUsd: input.networkLimitMicroUsd ?? null,
						mode: input.mode,
						warningThresholdBasisPoints: input.warningThresholdBasisPoints,
						desiredMinimumRunwayMinutes:
							input.desiredMinimumRunwayMinutes ??
							BILLING_POLICY.minimumRunwayMinutes,
						updatedBy: userId,
						updatedAt,
					});
				budget.resourceVersion = currentVersion + 1;
				budget.monthlyLimitMicroUsd = input.monthlyLimitMicroUsd;
				budget.networkLimitMicroUsd = input.networkLimitMicroUsd ?? null;
				budget.mode = input.mode;
				budget.warningThresholdBasisPoints = input.warningThresholdBasisPoints;
				budget.desiredMinimumRunwayMinutes =
					input.desiredMinimumRunwayMinutes ??
					current?.desiredMinimumRunwayMinutes ??
					BILLING_POLICY.minimumRunwayMinutes;
				budget.updatedBy = userId;
				budget.updatedAt = updatedAt;
				manager.persist(budget);
				manager.persist(
					manager.create(BillingBudgetVersion, {
						organizationId: budget.organizationId,
						resourceVersion: budget.resourceVersion,
						monthlyLimitMicroUsd: budget.monthlyLimitMicroUsd,
						networkLimitMicroUsd: budget.networkLimitMicroUsd,
						mode: budget.mode,
						warningThresholdBasisPoints: budget.warningThresholdBasisPoints,
						desiredMinimumRunwayMinutes: budget.desiredMinimumRunwayMinutes,
						updatedBy: budget.updatedBy,
						updatedAt: budget.updatedAt,
					})
				);
				return toDto(budget);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}

function assertPositive(value: string, label: string): void {
	if (!MicroUsd.parse(value).isPositive())
		throw new ConflictException(`${label} must be positive`);
}

function toDto(budget: BillingBudget): BillingBudgetDto {
	return {
		resourceVersion: budget.resourceVersion,
		monthlyLimitMicroUsd: budget.monthlyLimitMicroUsd,
		networkLimitMicroUsd: budget.networkLimitMicroUsd ?? undefined,
		mode: budget.mode,
		warningThresholdBasisPoints: budget.warningThresholdBasisPoints,
		desiredMinimumRunwayMinutes: budget.desiredMinimumRunwayMinutes,
		updatedAt: budget.updatedAt,
	};
}
