/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	AutoTopUp,
	BillingConfig,
	PaymentMethod,
	UpdateAutoTopUp,
} from '@snapflow/api-client';
import { autoTopUpAmountsError } from '#lib/features/billing/lib/top-up-limits.ts';
import { centsToUsdInput, usdInputToCents } from '#lib/utils/usd.ts';

interface AutoTopUpSource {
	config: BillingConfig;
	methods: readonly PaymentMethod[];
	policy: AutoTopUp;
}

interface AutoTopUpValues {
	enabled: boolean;
	threshold: string;
	amount: string;
	paymentMethodId: string;
}

function autoTopUpValues({
	methods,
	policy,
}: AutoTopUpSource): AutoTopUpValues {
	return {
		enabled: policy.enabled,
		threshold: policy.configured ? centsToUsdInput(policy.thresholdCents) : '',
		amount: policy.configured ? centsToUsdInput(policy.amountCents) : '',
		paymentMethodId: policy.paymentMethodId ?? methods[0]?.id ?? '',
	};
}

export class AutoTopUpDraft {
	readonly #source: () => AutoTopUpSource;
	#consentedVersion = $state<number | null>(null);
	readonly baseline: AutoTopUpValues;
	enabled: boolean;
	threshold: string;
	amount: string;
	paymentMethodId: string;
	readonly thresholdCents: number | null;
	readonly amountCents: number | null;
	readonly card: PaymentMethod | undefined;
	readonly amountsError: string | null;
	readonly dirty: boolean;
	readonly valid: boolean;

	constructor(source: () => AutoTopUpSource) {
		this.#source = source;
		this.baseline = $derived(autoTopUpValues(source()));
		this.enabled = $derived(this.baseline.enabled);
		this.threshold = $derived(this.baseline.threshold);
		this.amount = $derived(this.baseline.amount);
		this.paymentMethodId = $derived(this.baseline.paymentMethodId);
		this.thresholdCents = $derived(usdInputToCents(this.threshold));
		this.amountCents = $derived(usdInputToCents(this.amount));
		this.card = $derived(
			source().methods.find((method) => method.id === this.paymentMethodId)
		);
		this.amountsError = $derived(
			autoTopUpAmountsError(this.threshold, this.amount, source().config)
		);
		this.dirty = $derived(
			this.enabled !== this.baseline.enabled ||
				this.threshold !== this.baseline.threshold ||
				this.amount !== this.baseline.amount ||
				this.paymentMethodId !== this.baseline.paymentMethodId ||
				(Boolean(source().policy.suspendedReason) && this.consented)
		);
		this.valid = $derived(
			this.amountsError === null &&
				this.thresholdCents !== null &&
				this.amountCents !== null &&
				Boolean(this.card) &&
				(this.consented || !this.enabled)
		);
	}

	get resourceVersion(): number {
		return this.#source().policy.resourceVersion;
	}

	get consented(): boolean {
		return this.#consentedVersion === this.resourceVersion;
	}

	set consented(checked: boolean) {
		this.#consentedVersion = checked ? this.resourceVersion : null;
	}

	discard = (): void => {
		this.enabled = this.baseline.enabled;
		this.threshold = this.baseline.threshold;
		this.amount = this.baseline.amount;
		this.paymentMethodId = this.baseline.paymentMethodId;
		this.#consentedVersion = null;
	};

	policy(): UpdateAutoTopUp | null {
		if (
			!this.valid ||
			this.thresholdCents === null ||
			this.amountCents === null
		) {
			return null;
		}
		return {
			enabled: this.enabled,
			thresholdCents: this.thresholdCents,
			amountCents: this.amountCents,
			paymentMethodId: this.paymentMethodId,
		};
	}
}
