<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { watch } from 'runed';
import AuthFormMessage from '#lib/features/auth/components/layout/auth-form-message.svelte';
import AuthHeader from '#lib/features/auth/components/layout/auth-header.svelte';
import AuthSubmitButton from '#lib/features/auth/components/sign-in/auth-submit-button.svelte';
import AuthTextLink from '#lib/features/auth/components/sign-in/auth-text-link.svelte';
import { supportsPasskeys } from '#lib/features/auth/lib/sign-in/passkey-support.ts';
import { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { goto } from '$app/navigation';

interface SignupPasskeyPanelProps {
	returnTo: string;
}

let { returnTo }: SignupPasskeyPanelProps = $props();

const wallet = new UserWalletState();
const passkeysSupported = supportsPasskeys();
const ready = $derived(wallet.query.isSuccess && wallet.passkeysLoaded);
const createLabel = $derived(
	wallet.passkeys.length > 0 ? 'Create wallet' : 'Create passkey'
);

function proceed(): void {
	void goto(returnTo, { replace: true });
}

watch(
	() => wallet.wallet,
	(created) => {
		if (created) proceed();
	}
);
</script>

<div class="flex flex-col gap-8">
	<AuthHeader
		title="Create your passkey"
		description="Your passkey signs you in and owns your Snapflow wallet, which pays for sandboxes and receives your earnings."
	/>
	{#if passkeysSupported}
		<AuthSubmitButton
			type="button"
			loading={wallet.creating}
			disabled={!ready}
			onclick={wallet.createWallet}
		>
			{createLabel}
		</AuthSubmitButton>
	{:else}
		<AuthFormMessage type="error" align="center">
			This browser cannot create passkeys. You can create your wallet later from
			the Wallet page.
		</AuthFormMessage>
	{/if}
	<p class="text-center text-(--text-muted) text-sm">
		<AuthTextLink disabled={wallet.creating} onclick={proceed}>
			{passkeysSupported ? 'Skip for now' : 'Continue'}
		</AuthTextLink>
	</p>
</div>
