/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PaymentWalletPurpose } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import {
	billingBudgetQueryOptions,
	billingConfigQueryOptions,
	billingOverviewQueryOptions,
} from '#lib/api/billing/billing.ts';
import { voucherDelegationQueryOptions } from '#lib/api/settlement/delegation.ts';
import {
	autoTopUpQueryOptions,
	escrowAccountQueryOptions,
} from '#lib/api/settlement/escrow.ts';
import { paymentWalletsQueryOptions } from '#lib/api/settlement/wallets.ts';
import {
	fundingSetupComplete,
	fundingSetupSteps,
} from '#lib/features/billing/lib/funding-setup.ts';
import { linkedWallet } from '#lib/features/wallet/lib/payment-wallet.ts';
import { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { EscrowPendingRows } from './escrow-pending-rows.svelte.ts';
import { FundingSource } from './funding-source.svelte.ts';

export class BillingFunding {
	readonly #canManage: () => boolean;
	readonly overview = createQuery(() => billingOverviewQueryOptions());
	readonly account = createQuery(() => escrowAccountQueryOptions());
	readonly delegation = createQuery(() => voucherDelegationQueryOptions());
	readonly autoTopUp = createQuery(() => autoTopUpQueryOptions());
	readonly wallets = createQuery(() => paymentWalletsQueryOptions());
	readonly budget = createQuery(() => billingBudgetQueryOptions());
	readonly config = createQuery(() => billingConfigQueryOptions());
	readonly wallet = new UserWalletState();
	readonly connected = new ConnectedWallet();
	readonly fundingWallet = $derived(
		linkedWallet(this.wallets.data, PaymentWalletPurpose.Funding)
	);
	readonly source = new FundingSource(
		() => this.fundingWallet?.address ?? null,
		() => this.wallet,
		() => this.connected
	);
	readonly pending = new EscrowPendingRows(() => this.account.data);
	readonly minimumDeposit = $derived(
		this.config.data ? BigInt(this.config.data.minimumDepositMicroUsd) : null
	);
	readonly steps = $derived(
		this.account.data
			? fundingSetupSteps(this.account.data, this.delegation.data)
			: null
	);
	readonly setupComplete = $derived(
		this.steps === null || fundingSetupComplete(this.steps)
	);
	readonly signing = $derived.by(
		() => this.#canManage() && this.source.signer !== null
	);

	constructor(canManage: () => boolean) {
		this.#canManage = canManage;
	}

	get canManage(): boolean {
		return this.#canManage();
	}
}
