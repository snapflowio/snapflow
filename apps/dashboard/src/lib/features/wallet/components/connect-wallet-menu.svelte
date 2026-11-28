<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import WalletIcon from '@lucide/svelte/icons/wallet';
import type { Connector } from '@wagmi/core';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuLabel from '#lib/components/ui/dropdown-menu/dropdown-menu-label.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import WalletConnectModal from '#lib/features/wallet/components/wallet-connect-modal.svelte';
import type { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import { walletFailure } from '#lib/integrations/wallet/wallet-error.ts';

interface ConnectWalletMenuProps {
	connected: ConnectedWallet;
}

let { connected }: ConnectWalletMenuProps = $props();

async function run(action: () => Promise<unknown>, failure: string) {
	try {
		await action();
	} catch (error) {
		const title = walletFailure(failure)(error);
		if (title) showApiError(error, title);
	}
}

function choose(connector: Connector): void {
	void run(() => connected.connect(connector), 'Could not connect the wallet');
}
</script>

{#if connected.connected}
	{#if !connected.onSettlementChain}
		<Chip
			variant="primary"
			onclick={() =>
				void run(connected.switchNetwork, 'Could not switch the network')}
		>
			{`Switch to ${connected.networkName}`}
		</Chip>
	{/if}
	<Chip
		onclick={() =>
			void run(connected.disconnect, 'Could not disconnect the wallet')}
	>
		Disconnect
	</Chip>
{:else}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<Chip
					loading={connected.connecting}
					{...props}
					leftIcon={WalletIcon}
					disabled={connected.connecting}
				>
					Connect wallet
				</Chip>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			{#each connected.connectors as connector (connector.uid)}
				<DropdownMenuItem onSelect={() => choose(connector)}>
					{#if connector.icon}
						<img src={connector.icon} alt="" class="size-4 shrink-0 rounded-sm">
					{:else}
						<WalletIcon />
					{/if}
					<span class={MENU_LABEL_CLASS}>{connector.name}</span>
				</DropdownMenuItem>
			{:else}
				<DropdownMenuLabel>No browser wallet found</DropdownMenuLabel>
			{/each}
		</DropdownMenuContent>
	</DropdownMenu>
{/if}
<WalletConnectModal
	uri={connected.pairingUri}
	onCancel={() =>
		void run(connected.cancelPairing, 'Could not cancel the connection')}
/>
