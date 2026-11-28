/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PaymentWalletPurpose } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { quietMutation } from '#lib/api/client/mutation-meta.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import { hostEscrowBalanceQueryOptions } from '#lib/api/settlement/escrow.ts';
import { unlinkPaymentWalletMutationOptions } from '#lib/api/settlement/wallets.ts';
import {
	EarningsView,
	earningsSearchSchema,
} from '#lib/features/earnings/lib/earnings-params.ts';
import {
	type NextPayout,
	nextPayout,
} from '#lib/features/earnings/lib/earnings-status.ts';
import { HostPayoutReadiness } from '#lib/features/machines/state/host-payout-readiness.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export const MANAGE_PAYOUTS_REASON = 'Ask a member who manages payouts';

export class EarningsPage {
	readonly #params = new SearchParams(earningsSearchSchema);
	readonly payout = new HostPayoutReadiness();
	readonly balance = createQuery(() => hostEscrowBalanceQueryOptions());
	readonly #unlink = createMutation(() =>
		quietMutation(unlinkPaymentWalletMutationOptions())
	);

	changingWallet = $state(false);
	exporting = $state(false);
	unlinking = $state(false);

	readonly view: EarningsView = $derived(this.#params.current.view);
	readonly machineFilter: string | null = $derived(
		this.#params.current.machine
	);
	readonly canManage = $derived(this.payout.canManage);
	readonly manageReason = $derived(
		this.canManage ? undefined : MANAGE_PAYOUTS_REASON
	);
	readonly wallet = $derived(this.payout.wallet);
	readonly walletLoaded = $derived(this.payout.query.isSuccess);
	readonly next: NextPayout | null = $derived(
		this.balance.data ? nextPayout(this.balance.data) : null
	);
	readonly firstRun = $derived(
		this.walletLoaded &&
			this.wallet === undefined &&
			(this.balance.data === undefined ||
				BigInt(this.balance.data.pendingMicroUsd) === 0n)
	);
	readonly unlinkPending = $derived(this.#unlink.isPending);
	readonly unlinkError = $derived(
		this.#unlink.error ? userErrorMessage(this.#unlink.error) : null
	);

	setView = (view: EarningsView): void => {
		void this.#params.update({ view });
	};

	showMachinePayouts = (machineId: string): void => {
		void this.#params.update({
			view: EarningsView.Payouts,
			machine: machineId,
		});
	};

	clearMachineFilter = (): void => {
		void this.#params.update({ machine: null });
	};

	openWalletChange = (): void => {
		if (this.canManage) this.changingWallet = true;
	};

	requestUnlink = (): void => {
		this.#unlink.reset();
		this.unlinking = true;
	};

	confirmUnlink = (): void => {
		this.#unlink.mutate(PaymentWalletPurpose.Payout, {
			onSuccess: () => {
				this.unlinking = false;
			},
		});
	};
}
