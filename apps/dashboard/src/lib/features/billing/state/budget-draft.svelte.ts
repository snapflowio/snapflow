/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	BillingBudgetDto,
	UpdateBillingBudgetDto,
} from '@snapflow/api-client';
import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';

export type BudgetMode = UpdateBillingBudgetDto['mode'];

const BASIS_POINTS_PER_PERCENT = 100;

interface BudgetValues {
	monthly: string;
	network: string;
	mode: BudgetMode;
	runway: string;
	warning: string;
}

function microUsdInput(microUsd: string | undefined): string {
	return microUsd === undefined ? '' : formatMicroUsdAmount(microUsd);
}

function budgetValues(budget: BillingBudgetDto): BudgetValues {
	return {
		monthly: microUsdInput(budget.monthlyLimitMicroUsd),
		network: microUsdInput(budget.networkLimitMicroUsd),
		mode: budget.mode,
		runway: String(budget.desiredMinimumRunwayMinutes),
		warning: String(
			budget.warningThresholdBasisPoints / BASIS_POINTS_PER_PERCENT
		),
	};
}

export class BudgetDraft {
	readonly #budget: () => BillingBudgetDto;
	readonly baseline: BudgetValues;
	monthly: string;
	network: string;
	mode: BudgetMode;
	runway: string;
	warning: string;
	readonly dirty: boolean;

	constructor(budget: () => BillingBudgetDto) {
		this.#budget = budget;
		this.baseline = $derived(budgetValues(budget()));
		this.monthly = $derived(this.baseline.monthly);
		this.network = $derived(this.baseline.network);
		this.mode = $derived(this.baseline.mode);
		this.runway = $derived(this.baseline.runway);
		this.warning = $derived(this.baseline.warning);
		this.dirty = $derived(
			this.monthly !== this.baseline.monthly ||
				this.network !== this.baseline.network ||
				this.mode !== this.baseline.mode ||
				this.runway !== this.baseline.runway ||
				this.warning !== this.baseline.warning
		);
	}

	get resourceVersion(): number {
		return this.#budget().resourceVersion;
	}

	discard = (): void => {
		this.monthly = this.baseline.monthly;
		this.network = this.baseline.network;
		this.mode = this.baseline.mode;
		this.runway = this.baseline.runway;
		this.warning = this.baseline.warning;
	};

	body(): UpdateBillingBudgetDto | null {
		const monthlyLimitMicroUsd = usdInputToMicroUsd(this.monthly);
		const networkLimitMicroUsd = this.network
			? usdInputToMicroUsd(this.network)
			: undefined;
		if (!monthlyLimitMicroUsd || networkLimitMicroUsd === null) return null;
		return {
			monthlyLimitMicroUsd,
			networkLimitMicroUsd,
			mode: this.mode,
			warningThresholdBasisPoints: Math.round(
				Number(this.warning) * BASIS_POINTS_PER_PERCENT
			),
			desiredMinimumRunwayMinutes: Number(this.runway),
		};
	}
}
