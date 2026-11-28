/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';

export const SignerLimitChange = {
	Raise: 'raise',
	Lower: 'lower',
} as const;

export type SignerLimitChange =
	(typeof SignerLimitChange)[keyof typeof SignerLimitChange];

const INVALID_HOURLY_CAP =
	'Enter the spending limit as a dollar amount per hour, like 2.50.';

export class SignerLimitDraft {
	readonly #current: () => string;
	hourlyCap = $state('');

	readonly next: bigint | null = $derived.by(() => {
		const microUsd = usdInputToMicroUsd(this.hourlyCap);
		return microUsd === null ? null : BigInt(microUsd);
	});

	readonly change: SignerLimitChange | null = $derived.by(() => {
		if (this.next === null) return null;
		const current = BigInt(this.#current());
		if (this.next === current) return null;
		return this.next > current
			? SignerLimitChange.Raise
			: SignerLimitChange.Lower;
	});

	readonly error = $derived(this.next === null ? INVALID_HOURLY_CAP : null);

	readonly ready = $derived(this.error === null && this.change !== null);

	constructor(current: () => string) {
		this.#current = current;
		this.reset();
	}

	reset = (): void => {
		this.hourlyCap = formatMicroUsdAmount(this.#current());
	};
}
