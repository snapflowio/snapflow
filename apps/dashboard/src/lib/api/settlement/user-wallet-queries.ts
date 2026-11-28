/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiErrorCode,
	getUserWallet,
	RecoveryStatus,
	type UserWallet,
} from '@snapflow/api-client';
import { client } from '@snapflow/api-client/client.gen';
import {
	getUserWalletQueryKey,
	listWalletTransactionsOptions,
	listWalletTransactionsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';

const WALLET_REFRESH_MILLISECONDS = 10_000;

export const USER_WALLET_QUERY_KEYS = [
	getUserWalletQueryKey(),
	listWalletTransactionsQueryKey(),
];

export function userWalletQueryOptions() {
	return queryOptions({
		queryKey: getUserWalletQueryKey(),
		queryFn: async ({ signal }): Promise<UserWallet | null> => {
			try {
				return (await getUserWallet({ signal })).data;
			} catch (error) {
				if (hasErrorCode(error, ApiErrorCode.UserWalletNotFound)) return null;
				throw error;
			}
		},
		refetchInterval: (query) =>
			query.state.data?.recoveryStatus === RecoveryStatus.Pending
				? WALLET_REFRESH_MILLISECONDS
				: false,
	});
}

export function walletTransactionsQueryOptions() {
	return queryOptions({
		...listWalletTransactionsOptions(),
		refetchInterval: WALLET_REFRESH_MILLISECONDS,
	});
}

export function createUserWalletMutationOptions() {
	return mutationOptions({
		mutationFn: async (passkeyId: string | undefined) => {
			const { WalletService } = await import('@snapflow/sdk');
			return new WalletService(client).create(passkeyId);
		},
		meta: {
			success: 'Wallet created',
			failure: 'Failed to create your wallet',
			invalidates: USER_WALLET_QUERY_KEYS,
		},
	});
}
