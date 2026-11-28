/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RecoveryStatus, type UserWallet } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { type Address, getAddress } from 'viem';
import {
	addPasskeyMutationOptions,
	passkeysQueryOptions,
} from '#lib/api/account/passkeys.ts';
import { ClientErrorCode } from '#lib/api/errors/error-catalog.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { getPublicConfig } from '#lib/api/public-config.ts';
import {
	type EscrowFunder,
	safeEscrowFunder,
} from '#lib/api/settlement/escrow-writes.ts';
import type { WalletSigning } from '#lib/api/settlement/user-wallet.ts';
import {
	createUserWalletMutationOptions,
	userWalletQueryOptions,
} from '#lib/api/settlement/user-wallet-queries.ts';
import {
	passkeySigner,
	signingPasskeys,
	walletPasskey,
} from '#lib/features/wallet/lib/wallet-signer.ts';
import { WalletFeeConfirmation } from '#lib/features/wallet/state/wallet-fee-confirmation.svelte.ts';
import { usdcBalanceQueryOptions } from '#lib/integrations/wallet/usdc-balance.ts';
import { settlementWallets } from '#lib/integrations/wallet/wallet-config.ts';

const WALLET_PASSKEY_NAME = 'Snapflow wallet';

export class UserWalletState {
	readonly #config = getPublicConfig();
	readonly settlement = this.#config.settlement;
	readonly query = createQuery(() => userWalletQueryOptions());
	readonly #passkeys = createQuery(() => passkeysQueryOptions());
	readonly #create = createMutation(() => createUserWalletMutationOptions());
	readonly #addPasskey = createMutation(() => addPasskeyMutationOptions());
	readonly feeConfirmation = new WalletFeeConfirmation();

	readonly wallet: UserWallet | null = $derived(this.query.data ?? null);
	readonly address: Address | null = $derived(
		this.wallet ? getAddress(this.wallet.safeAddress) : null
	);
	readonly balance = createQuery(() =>
		usdcBalanceQueryOptions(this.settlement, this.address)
	);
	readonly passkeys = $derived(this.#passkeys.data ?? []);
	readonly passkeysLoaded = $derived(this.#passkeys.isSuccess);
	readonly passkey = $derived(
		this.wallet ? walletPasskey(this.wallet, this.passkeys) : null
	);
	readonly #signers = $derived(
		this.wallet ? signingPasskeys(this.wallet, this.passkeys) : []
	);
	readonly signing: WalletSigning | null = $derived(
		this.wallet && this.#signers.length > 0
			? {
					signer: passkeySigner(this.#signers, this.#config.passkeyRpId),
					target: {
						chainId: this.settlement.chainId,
						safeAddress: this.wallet.safeAddress,
					},
				}
			: null
	);
	readonly recoveryActive = $derived(
		this.wallet?.recoveryStatus === RecoveryStatus.Active
	);
	readonly creating = $derived(
		this.#create.isPending || this.#addPasskey.isPending
	);

	createWallet = (): void => {
		if (!this.passkeysLoaded) return;
		if (this.passkeys.length > 0) {
			this.#create.mutate(undefined);
			return;
		}
		this.#addPasskey.mutate(WALLET_PASSKEY_NAME, {
			onSuccess: (passkey) => this.#create.mutate(passkey.id),
		});
	};

	escrowFunder = (): Promise<EscrowFunder> => {
		if (!this.signing)
			return Promise.reject(
				new SnapflowError('', { code: ClientErrorCode.WALLET_PASSKEY_MISSING })
			);
		return safeEscrowFunder(
			this.signing.signer,
			settlementWallets(this.settlement).publicClient,
			this.feeConfirmation.request
		);
	};
}
