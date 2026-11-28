/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ApiKeyBudget, UpdateApiKeyBudget } from '@snapflow/api-client';
import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';

const COUNT_PATTERN = /^\d+$/;
const MINIMUM_CONCURRENT_SANDBOXES = 1;

const INVALID_SPEND_LIMIT =
	'Enter the compute spend limit as a dollar amount, like 50, or leave it empty.';
const INVALID_CONCURRENCY = `Enter a whole number of sandboxes, at least ${MINIMUM_CONCURRENT_SANDBOXES}, or leave it empty.`;

function concurrencyOf(value: string): number | null | undefined {
	const trimmed = value.trim();
	if (trimmed === '') return null;
	if (!COUNT_PATTERN.test(trimmed)) return undefined;
	const count = Number(trimmed);
	return count >= MINIMUM_CONCURRENT_SANDBOXES ? count : undefined;
}

function spendLimitOf(value: string): string | null | undefined {
	if (value.trim() === '') return null;
	return usdInputToMicroUsd(value) ?? undefined;
}

export class ApiKeyBudgetDraft {
	readonly #budget: () => ApiKeyBudget;
	spendLimit = $state('');
	maxConcurrent = $state('');

	readonly error = $derived.by(() => {
		if (spendLimitOf(this.spendLimit) === undefined) return INVALID_SPEND_LIMIT;
		return concurrencyOf(this.maxConcurrent) === undefined
			? INVALID_CONCURRENCY
			: null;
	});

	constructor(budget: () => ApiKeyBudget) {
		this.#budget = budget;
		this.reset();
	}

	reset = (): void => {
		const budget = this.#budget();
		this.spendLimit =
			budget.computeSpendLimitMicroUsd === null
				? ''
				: formatMicroUsdAmount(budget.computeSpendLimitMicroUsd);
		this.maxConcurrent =
			budget.maxConcurrentSandboxes === null
				? ''
				: String(budget.maxConcurrentSandboxes);
	};

	body(): UpdateApiKeyBudget | null {
		const computeSpendLimitMicroUsd = spendLimitOf(this.spendLimit);
		const maxConcurrentSandboxes = concurrencyOf(this.maxConcurrent);
		if (
			computeSpendLimitMicroUsd === undefined ||
			maxConcurrentSandboxes === undefined
		)
			return null;
		return { computeSpendLimitMicroUsd, maxConcurrentSandboxes };
	}
}
