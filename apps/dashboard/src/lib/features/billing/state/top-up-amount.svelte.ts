/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingConfig } from '@snapflow/api-client';
import {
	defaultTopUpCents,
	topUpAmountError,
	topUpLimitsHint,
	topUpPresets,
} from '#lib/features/billing/lib/top-up-limits.ts';
import {
	centsToUsdInput,
	formatCentsShort,
	usdInputToCents,
} from '#lib/utils/usd.ts';

export class TopUpAmount {
	readonly #config: () => BillingConfig;
	amount = $state('');

	readonly error = $derived.by(() =>
		topUpAmountError(this.amount, this.#config())
	);
	readonly cents = $derived(
		this.error === null ? usdInputToCents(this.amount) : null
	);
	readonly showError = $derived(
		this.amount.trim() !== '' && this.error !== null
	);
	readonly hint = $derived.by(() => topUpLimitsHint(this.#config()));
	readonly presetOptions = $derived.by(() =>
		topUpPresets(this.#config()).map((cents) => ({
			value: String(cents),
			label: formatCentsShort(cents),
		}))
	);
	readonly selectedPreset = $derived(
		this.cents !== null &&
			this.presetOptions.some((option) => option.value === String(this.cents))
			? String(this.cents)
			: ''
	);

	constructor(config: () => BillingConfig) {
		this.#config = config;
		this.amount = centsToUsdInput(defaultTopUpCents(config()));
	}

	selectPreset = (cents: string): void => {
		this.amount = centsToUsdInput(Number(cents));
	};
}
