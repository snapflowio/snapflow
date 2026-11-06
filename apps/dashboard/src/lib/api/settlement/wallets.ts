/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateWalletChallenge,
	createWalletChallenge,
	linkPaymentWallet,
	type PaymentWallet,
	type PaymentWalletPurpose,
	unlinkPaymentWallet,
} from '@snapflow/api-client';
import {
	getBillingOverviewQueryKey,
	getEscrowAccountQueryKey,
	getVoucherDelegationQueryKey,
	listPaymentWalletsOptions,
	listPaymentWalletsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

type SignWalletMessage = (message: string) => Promise<string>;

const WALLET_QUERY_KEYS = [
	listPaymentWalletsQueryKey(),
	getEscrowAccountQueryKey(),
	getVoucherDelegationQueryKey(),
	getBillingOverviewQueryKey(),
];

export function paymentWalletsQueryOptions() {
	return listPaymentWalletsOptions();
}

export function linkPaymentWalletMutationOptions(
	signMessage: SignWalletMessage
) {
	return mutationOptions({
		mutationFn: async (body: CreateWalletChallenge): Promise<PaymentWallet> => {
			const { message } = (await createWalletChallenge({ body })).data;
			const signature = await signMessage(message);
			return (
				await linkPaymentWallet({
					body: { purpose: body.purpose, message, signature },
				})
			).data;
		},
		meta: {
			success: 'Wallet linked',
			failure: 'Failed to link the wallet',
			invalidates: WALLET_QUERY_KEYS,
		},
	});
}

export function unlinkPaymentWalletMutationOptions() {
	return mutationOptions({
		mutationFn: (purpose: PaymentWalletPurpose) =>
			unlinkPaymentWallet({ path: { purpose } }),
		meta: {
			success: 'Wallet unlinked',
			failure: 'Failed to unlink the wallet',
			invalidates: WALLET_QUERY_KEYS,
		},
	});
}
