/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type RecoveryOwner, RecoveryOwnerKind } from '@snapflow/api-client';
import {
	generateRecoveryPhrase,
	type PreparedRecoveryOwner,
	type RecoveryPhrase,
	type SiweSigner,
} from '@snapflow/sdk';
import { createMutation } from '@tanstack/svelte-query';
import { addPasskeyMutationOptions } from '#lib/api/account/passkeys.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import {
	addRecoveryOwnerMutationOptions,
	prepareRecoveryOwnerMutationOptions,
} from '#lib/api/settlement/user-wallet.ts';
import {
	confirmWordIndices,
	phraseWords,
	wordMatches,
} from '#lib/features/wallet/lib/recovery-phrase-check.ts';
import type { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';

type OwnerStep = 'confirm' | 'owner';

export type RecoveryStep = 'choose' | 'phrase' | OwnerStep | 'fee';

const RECOVERY_PASSKEY_NAME = 'Wallet recovery';
const OWNER_WALLET_FAILURE = 'Could not reach the connected wallet';

export class RecoverySetup {
	readonly #walletOf: () => UserWalletState;
	readonly #connectedOf: () => ConnectedWallet;

	kind = $state<RecoveryOwnerKind>(RecoveryOwnerKind.Phrase);
	step = $state<RecoveryStep>('choose');
	wroteDown = $state(false);
	confirmInputs = $state<string[]>([]);
	passkeyId = $state<string | null>(null);
	prepared = $state.raw<PreparedRecoveryOwner | null>(null);
	#ownerStep = $state<OwnerStep>('owner');
	#phrase = $state.raw<RecoveryPhrase | null>(null);
	#confirmIndices = $state.raw<readonly number[]>([]);

	readonly preparation = createMutation(() =>
		prepareRecoveryOwnerMutationOptions()
	);
	readonly mutation = createMutation(() => addRecoveryOwnerMutationOptions());
	readonly pending = $derived(
		this.preparation.isPending || this.mutation.isPending
	);
	readonly addPasskey = createMutation(() => addPasskeyMutationOptions());
	readonly #wallet = $derived.by(() => this.#walletOf());
	readonly #connected = $derived.by(() => this.#connectedOf());

	readonly words = $derived(
		this.#phrase ? phraseWords(this.#phrase.phrase) : []
	);
	readonly confirmWords = $derived(
		this.#confirmIndices.map((index, position) => ({
			index,
			position,
			matches: wordMatches(
				this.words[index] ?? '',
				this.confirmInputs[position] ?? ''
			),
		}))
	);
	readonly otherPasskeys = $derived(
		this.#wallet.passkeys.filter(
			(passkey) => passkey.id !== this.#wallet.wallet?.passkeyId
		)
	);
	readonly owner: RecoveryOwner | null = $derived.by(() => {
		switch (this.kind) {
			case RecoveryOwnerKind.Phrase:
				return this.#phrase && this.confirmWords.every((word) => word.matches)
					? { kind: this.kind, address: this.#phrase.address }
					: null;
			case RecoveryOwnerKind.Passkey:
				return this.passkeyId
					? { kind: this.kind, passkeyId: this.passkeyId }
					: null;
			case RecoveryOwnerKind.Wallet:
				return this.#connected.address
					? { kind: this.kind, address: this.#connected.address }
					: null;
		}
	});
	readonly canContinue = $derived.by(() => {
		if (this.step === 'choose') return true;
		if (this.step === 'phrase') return this.wroteDown;
		if (this.step === 'fee') return this.prepared !== null && !this.pending;
		return this.owner !== null && !this.pending;
	});

	constructor(wallet: () => UserWalletState, connected: () => ConnectedWallet) {
		this.#walletOf = wallet;
		this.#connectedOf = connected;
	}

	reset = (): void => {
		this.kind = RecoveryOwnerKind.Phrase;
		this.step = 'choose';
		this.wroteDown = false;
		this.confirmInputs = [];
		this.passkeyId = null;
		this.prepared = null;
		this.#phrase = null;
		this.#confirmIndices = [];
		this.preparation.reset();
		this.mutation.reset();
	};

	next = (): void => {
		if (this.step === 'choose') {
			if (this.kind === RecoveryOwnerKind.Phrase) {
				this.#phrase = generateRecoveryPhrase();
				this.step = 'phrase';
			} else {
				this.step = 'owner';
			}
			return;
		}
		if (this.step === 'phrase') {
			this.#confirmIndices = confirmWordIndices(this.words.length);
			this.confirmInputs = this.#confirmIndices.map(() => '');
			this.step = 'confirm';
			return;
		}
		if (this.step === 'confirm' || this.step === 'owner') {
			this.#prepare(this.step);
		}
	};

	back = (): void => {
		if (this.step === 'fee') {
			this.prepared = null;
			this.step = this.#ownerStep;
			return;
		}
		if (this.step === 'confirm') {
			this.step = 'phrase';
			return;
		}
		this.reset();
	};

	addRecoveryPasskey = (): void => {
		this.addPasskey.mutate(RECOVERY_PASSKEY_NAME, {
			onSuccess: (passkey) => {
				this.passkeyId = passkey.id;
			},
		});
	};

	#prepare = (from: OwnerStep): void => {
		const signing = this.#wallet.signing;
		const owner = this.owner;
		if (!(signing && owner) || this.pending) return;
		this.preparation.mutate(
			{ owner, target: signing.target },
			{
				onSuccess: (prepared) => {
					this.prepared = prepared;
					this.#ownerStep = from;
					this.step = 'fee';
				},
			}
		);
	};

	submit = async (onDone: () => void): Promise<void> => {
		const signing = this.#wallet.signing;
		const prepared = this.prepared;
		if (!(signing && prepared) || this.pending) return;
		let ownerWallet: SiweSigner | undefined;
		try {
			ownerWallet =
				prepared.owner.kind === RecoveryOwnerKind.Wallet
					? await this.#connected.walletClient()
					: undefined;
		} catch (error) {
			showApiError(error, OWNER_WALLET_FAILURE);
			return;
		}
		this.mutation.mutate(
			{ prepared, signer: signing.signer, ownerWallet },
			{
				onError: () => {
					this.prepared = null;
					this.step = this.#ownerStep;
				},
				onSuccess: () => {
					this.reset();
					onDone();
				},
			}
		);
	};
}
