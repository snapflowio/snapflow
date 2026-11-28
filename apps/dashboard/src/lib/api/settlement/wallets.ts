/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PaymentWalletPurpose } from '@snapflow/api-client';
import { client } from '@snapflow/api-client/client.gen';
import {
	getBillingOverviewQueryKey,
	getEscrowAccountQueryKey,
	getHostEscrowBalanceQueryKey,
	getVoucherDelegationQueryKey,
	listPaymentWalletsOptions,
	listPaymentWalletsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { PaymentWalletService, type SiweSigner } from '@snapflow/sdk';
import { mutationOptions } from '@tanstack/svelte-query';
import {
	walletFailure,
	walletMutationFn,
} from '#lib/integrations/wallet/wallet-error.ts';

interface SiweWalletLink {
	purpose: PaymentWalletPurpose;
	wallet: SiweSigner;
}

const paymentWallets = new PaymentWalletService(client);

const WALLET_QUERY_KEYS = [
	listPaymentWalletsQueryKey(),
	getEscrowAccountQueryKey(),
	getHostEscrowBalanceQueryKey(),
	getVoucherDelegationQueryKey(),
	getBillingOverviewQueryKey(),
];

export function paymentWalletsQueryOptions() {
	return listPaymentWalletsOptions();
}

export function linkOwnPaymentWalletMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn((purpose: PaymentWalletPurpose) =>
			paymentWallets.linkOwn(purpose)
		),
		meta: {
			success: 'Wallet linked',
			failure: walletFailure('Failed to link your wallet'),
			invalidates: WALLET_QUERY_KEYS,
		},
	});
}

export function linkPaymentWalletMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(({ purpose, wallet }: SiweWalletLink) =>
			paymentWallets.link(purpose, wallet)
		),
		meta: {
			success: 'Wallet linked',
			failure: walletFailure('Failed to link the wallet'),
			invalidates: WALLET_QUERY_KEYS,
		},
	});
}

export function unlinkPaymentWalletMutationOptions() {
	return mutationOptions({
		mutationFn: (purpose: PaymentWalletPurpose) =>
			paymentWallets.unlink(purpose),
		meta: {
			success: 'Wallet unlinked',
			failure: 'Failed to unlink the wallet',
			invalidates: WALLET_QUERY_KEYS,
		},
	});
}
