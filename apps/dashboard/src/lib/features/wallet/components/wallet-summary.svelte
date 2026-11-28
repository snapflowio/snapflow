<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import type { UserWallet } from '@snapflow/api-client';
import PageSection from '#lib/components/detail/page-section.svelte';
import Well from '#lib/components/detail/well.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import { passkeyLabel } from '#lib/features/account/state/passkey-label.svelte.ts';
import { WELL_FOOTER_LINK_CLASS } from '#lib/features/billing/lib/well-footer-link.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { settlementChain } from '#lib/integrations/wallet/wallet-networks.ts';
import { formatDate } from '#lib/utils/format.ts';

interface WalletSummaryProps {
	wallet: UserWalletState;
	account: UserWallet;
	onReceive: () => void;
	onSend: () => void;
}

const BALANCE_UNAVAILABLE = '—';
const REMOVED_PASSKEY = 'Removed';

let { wallet, account, onReceive, onSend }: WalletSummaryProps = $props();

const networkName = $derived(settlementChain(wallet.settlement.chainId).name);
const passkeyName = $derived(
	wallet.passkey ? passkeyLabel(wallet.passkey) : REMOVED_PASSKEY
);
</script>

<div class="flex flex-col gap-y-12">
	<Well
		title="Balance"
		info={`Your self-custodial USDC wallet on ${networkName}, owned by your passkey.`}
		loading={wallet.balance.isLoading}
	>
		{#snippet actions()}
			<Chip variant="secondary" leftIcon={ArrowDownLeft} onclick={onReceive}>
				Receive
			</Chip>
		{/snippet}
		{#if wallet.balance.data !== undefined}
			<p class="flex items-baseline gap-x-2">
				<Money class="heading-s" microUsd={wallet.balance.data} />
				<span class="text-(--text-muted) text-sm">USDC</span>
			</p>
		{:else}
			<p class="heading-s text-(--text-disabled)">{BALANCE_UNAVAILABLE}</p>
		{/if}
		{#snippet footer()}
			<AddressDisplay value={account.safeAddress} form="full" />
			<Chip
				variant="ghost"
				size="compact"
				leftIcon={ArrowUpRight}
				class={WELL_FOOTER_LINK_CLASS}
				onclick={onSend}
			>
				Send
			</Chip>
		{/snippet}
	</Well>
	<PageSection title="Details">
		<KeyValueList label="Wallet details">
			<KeyValueRow label="Owner passkey" value={passkeyName} />
			<KeyValueRow
				label="Account"
				value={account.deployed && account.deployedAt
					? `Deployed ${formatDate(account.deployedAt)}`
					: 'Deploys with its first transaction'}
			/>
			<KeyValueRow label="Network fees" value="Paid in USDC per transaction" />
		</KeyValueList>
	</PageSection>
</div>
