/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PreparedWalletCall } from '@snapflow/sdk';

type FeeDecision = (approved: boolean) => void;

export class WalletFeeConfirmation {
	prepared = $state.raw<PreparedWalletCall | null>(null);
	#decide: FeeDecision | null = null;

	readonly feeMicroUsd = $derived(
		this.prepared?.transaction.feeMicroUsd ?? null
	);

	request = (prepared: PreparedWalletCall): Promise<boolean> => {
		this.#settle(false);
		this.prepared = prepared;
		return new Promise<boolean>((resolve) => {
			this.#decide = resolve;
		});
	};

	approve = (): void => {
		this.#settle(true);
	};

	decline = (): void => {
		this.#settle(false);
	};

	#settle(approved: boolean): void {
		const decide = this.#decide;
		this.#decide = null;
		this.prepared = null;
		decide?.(approved);
	}
}
