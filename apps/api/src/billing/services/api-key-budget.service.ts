/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { AuthErrorCode } from '../../auth/enums/auth-error-code.enum';
import { SECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import {
	AUTH_CREDENTIAL_TYPES,
	type AuthCredential,
} from '../../common/types/organization-auth-context.types';
import { apiError } from '../../common/utils/error/api-error.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { API_KEY_BUDGET_MESSAGES } from '../constants/billing-admission.constants';
import { FUNDING_POLICY } from '../constants/funding.constants';
import type {
	ApiKeyBudgetDto,
	UpdateApiKeyBudgetDto,
} from '../dto/api-key-budget.dto';
import { ApiKeyBudget } from '../entities/api-key-budget.entity';
import { BillingRestriction } from '../enums/billing-restriction.enum';
import { BillingRestrictedException } from '../exceptions/billing-restricted.exception';
import { type ApiKeyUsage, apiKeyUsage } from '../queries/api-key-usage.query';
import { coverageMicroUsd, fundsExhausted } from '../utils/funding/runway.util';

type BudgetLimits = Pick<
	ApiKeyBudget,
	'computeSpendLimitMicroUsd' | 'maxConcurrentSandboxes'
>;

function remainingBudget(
	budget: BudgetLimits,
	usage: ApiKeyUsage
): MicroUsd | null {
	const limit = MicroUsd.parseNullable(budget.computeSpendLimitMicroUsd);
	return limit === null ? null : limit.subtract(usage.computeSpendMicroUsd);
}

function spendExhausted(
	remaining: MicroUsd | null,
	usage: ApiKeyUsage,
	stopHorizonMinutes: number
): boolean {
	return (
		remaining !== null &&
		(!remaining.isPositive() ||
			fundsExhausted(
				remaining,
				usage.computeBurnMicroUsdPerHour,
				stopHorizonMinutes * SECONDS_PER_MINUTE
			))
	);
}

function concurrencyExhausted(
	budget: BudgetLimits,
	usage: ApiKeyUsage
): boolean {
	return (
		budget.maxConcurrentSandboxes !== null &&
		usage.runningSandboxes >= budget.maxConcurrentSandboxes
	);
}

@Injectable()
export class ApiKeyBudgetService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService
	) {}

	async get(
		organizationId: string,
		apiKeyId: string
	): Promise<ApiKeyBudgetDto> {
		const manager = this.entityManager.fork();
		await this.assertOwned(manager, organizationId, apiKeyId);
		const budget = await manager.findOne(ApiKeyBudget, { apiKeyId });
		const limits: BudgetLimits = budget ?? {
			computeSpendLimitMicroUsd: null,
			maxConcurrentSandboxes: null,
		};
		const usage = await apiKeyUsage(manager, apiKeyId);
		const remaining = remainingBudget(limits, usage);
		return {
			apiKeyId,
			...limits,
			computeSpendMicroUsd: usage.computeSpendMicroUsd.toString(),
			remainingMicroUsd: remaining?.nonnegative().toString() ?? null,
			computeBurnMicroUsdPerHour: usage.computeBurnMicroUsdPerHour.toString(),
			runningSandboxes: usage.runningSandboxes,
			exhausted:
				spendExhausted(remaining, usage, await this.stopHorizonMinutes()) ||
				concurrencyExhausted(limits, usage),
		};
	}

	async update(
		organizationId: string,
		apiKeyId: string,
		input: UpdateApiKeyBudgetDto
	): Promise<ApiKeyBudgetDto> {
		await this.entityManager.fork().transactional(async (manager) => {
			await this.assertOwned(manager, organizationId, apiKeyId);
			if (
				input.computeSpendLimitMicroUsd === null &&
				input.maxConcurrentSandboxes === null
			) {
				await manager.nativeDelete(ApiKeyBudget, { apiKeyId });
				return;
			}
			await manager.upsert(
				ApiKeyBudget,
				{
					apiKeyId,
					organizationId,
					computeSpendLimitMicroUsd: input.computeSpendLimitMicroUsd,
					maxConcurrentSandboxes: input.maxConcurrentSandboxes,
					updatedAt: await databaseNow(manager),
				},
				{ onConflictFields: ['apiKeyId'] }
			);
		});
		return this.get(organizationId, apiKeyId);
	}

	async assertCanStart(
		credential: AuthCredential,
		startingHourly: () => Promise<MicroUsd>
	): Promise<void> {
		if (credential.type !== AUTH_CREDENTIAL_TYPES.API_KEY) return;
		const manager = this.entityManager.fork();
		const budget = await manager.findOne(ApiKeyBudget, {
			apiKeyId: credential.id,
		});
		if (!budget) return;
		const usage = await apiKeyUsage(manager, credential.id);
		const limit = MicroUsd.parseNullable(budget.computeSpendLimitMicroUsd);
		const remaining = limit?.subtract(usage.computeSpendMicroUsd) ?? null;
		if (limit && remaining && !remaining.isPositive()) {
			throw new BillingRestrictedException(
				BillingRestriction.API_KEY_BUDGET_EXHAUSTED,
				{
					requiredMicroUsd: usage.computeSpendMicroUsd,
					availableMicroUsd: limit,
				},
				API_KEY_BUDGET_MESSAGES.exhausted(usage.computeSpendMicroUsd, limit)
			);
		}
		if (concurrencyExhausted(budget, usage)) {
			throw new BillingRestrictedException(
				BillingRestriction.API_KEY_CONCURRENCY_EXHAUSTED,
				{
					requiredMicroUsd: MicroUsd.ZERO,
					availableMicroUsd: MicroUsd.ZERO,
				}
			);
		}
		if (remaining === null) return;
		const horizonMinutes = await this.stopHorizonMinutes();
		const projected = coverageMicroUsd(
			usage.computeBurnMicroUsdPerHour.add(await startingHourly()),
			horizonMinutes * SECONDS_PER_MINUTE
		);
		if (remaining.lessThan(projected)) {
			throw new BillingRestrictedException(
				BillingRestriction.API_KEY_BUDGET_WOULD_BE_EXCEEDED,
				{ requiredMicroUsd: projected, availableMicroUsd: remaining },
				API_KEY_BUDGET_MESSAGES.wouldBeExceeded(
					remaining,
					projected,
					horizonMinutes
				)
			);
		}
	}

	async spendExhaustedBudgets(): Promise<ApiKeyBudget[]> {
		const manager = this.entityManager.fork();
		const budgets = await manager.find(ApiKeyBudget, {
			computeSpendLimitMicroUsd: { $ne: null },
		});
		const horizonMinutes = await this.stopHorizonMinutes();
		const exhausted: ApiKeyBudget[] = [];
		for (const budget of budgets) {
			const usage = await apiKeyUsage(manager, budget.apiKeyId);
			if (
				spendExhausted(remainingBudget(budget, usage), usage, horizonMinutes)
			) {
				exhausted.push(budget);
			}
		}
		return exhausted;
	}

	private async stopHorizonMinutes(): Promise<number> {
		const { fundsStopMarginMinutes } = await this.settings.get();
		return FUNDING_POLICY.jobIntervalMinutes + fundsStopMarginMinutes;
	}

	private async assertOwned(
		manager: EntityManager,
		organizationId: string,
		apiKeyId: string
	): Promise<void> {
		const key = await manager.findOne(
			ApiKey,
			{ id: apiKeyId, referenceId: organizationId },
			{ fields: ['id'] }
		);
		if (!key)
			throw new NotFoundException(
				apiError(
					AuthErrorCode.API_KEY_NOT_FOUND,
					'The API key was not found. Check the key ID; the key may have been deleted.'
				)
			);
	}
}
