<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import type {
	Wallet,
	WalletConnection,
} from '#lib/features/billing/state/wallet.svelte.ts';

interface WalletGateProps {
	wallet: Wallet;
	children: Snippet<[WalletConnection]>;
}

let { wallet, children }: WalletGateProps = $props();
</script>

{#if wallet.state.status === 'ready'}
	{@render children(wallet.state.connection)}
{:else if wallet.state.status === 'unconfigured'}
	<Notice>
		{#snippet title()}
			Wallet connection is not set up
		{/snippet}
		{#snippet description()}
			This deployment has no wallet connection project configured, so wallets
			cannot be connected here.
		{/snippet}
	</Notice>
{:else if wallet.state.status === 'failed'}
	<FeedbackState
		variant="inline"
		tone="error"
		message={`The wallet connection could not be loaded. ${wallet.state.error.message}`}
		onRetry={wallet.load}
	/>
{:else}
	<FeedbackState variant="inline" message="Loading the wallet connection..." />
{/if}
