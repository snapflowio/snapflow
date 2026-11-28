/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiErrorCode } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { passkeysQueryOptions } from '#lib/api/account/passkeys.ts';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import {
	createUserWalletMutationOptions,
	userWalletQueryOptions,
} from '#lib/api/settlement/user-wallet-queries.ts';

const CREATE_FAILURE = 'Failed to create your wallet';

export class WalletProvisioning {
	readonly #wallet = createQuery(() => userWalletQueryOptions());
	readonly #passkeys = createQuery(() => passkeysQueryOptions());
	readonly #create = createMutation(() => {
		const options = createUserWalletMutationOptions();
		return { ...options, meta: { ...options.meta, failure: undefined } };
	});
	#attemptedPasskeys = 0;

	constructor() {
		watch(
			() => [this.#wallet.data, this.#passkeys.data] as const,
			([wallet, passkeys]) => {
				if (
					wallet !== null ||
					!passkeys ||
					passkeys.length <= this.#attemptedPasskeys ||
					this.#create.isPending
				) {
					return;
				}
				this.#attemptedPasskeys = passkeys.length;
				this.#create.mutate(undefined, {
					onError: (error) => {
						if (!hasErrorCode(error, ApiErrorCode.WalletPasskeyNotP256)) {
							showApiError(error, CREATE_FAILURE);
						}
					},
				});
			}
		);
	}
}
