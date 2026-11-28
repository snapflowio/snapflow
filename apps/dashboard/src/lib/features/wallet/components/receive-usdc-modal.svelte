<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ADDRESS_QR_SIZE_PX = 144;
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import QrCode from '#lib/components/ui/qr-code.svelte';
import {
	BASE_USDC_EXCHANGES,
	EXCHANGES_WITHOUT_BASE,
	supportsExchangeWithdrawals,
} from '#lib/features/wallet/lib/exchanges.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { settlementChain } from '#lib/integrations/wallet/wallet-networks.ts';

interface ReceiveUsdcModalProps {
	open?: boolean;
	wallet: UserWalletState;
	address: string;
}

let {
	open = $bindable(false),
	wallet,
	address,
}: ReceiveUsdcModalProps = $props();

const clipboard = new CopyToClipboard();
const networkName = $derived(settlementChain(wallet.settlement.chainId).name);
const exchangesInfo = $derived(
	`Withdraw USDC from your exchange, choose the ${networkName} network and paste this address. ${EXCHANGES_WITHOUT_BASE.join(', ')} can't send USDC on ${networkName} yet.`
);

function close(): void {
	open = false;
}
</script>

<ChipModal bind:open srTitle="Receive USDC">
	<ChipModalHeader onClose={close}>Receive USDC</ChipModalHeader>
	<ChipModalBody>
		<div class="flex flex-col items-center gap-3 py-1">
			<QrCode
				value={address}
				label="Wallet address QR code"
				size={ADDRESS_QR_SIZE_PX}
			/>
			<AddressDisplay value={address} form="full" />
			<p class="text-(--text-secondary) text-sm">
				{`Send USDC on ${networkName} only.`}
			</p>
		</div>
		{#if supportsExchangeWithdrawals(wallet.settlement.chainId)}
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-1.5">
					<span class="font-medium text-(--text-subtle) text-xs"
						>From an exchange</span
					>
					<InfoTooltip content={exchangesInfo} />
				</div>
				<ul class="flex flex-col">
					{#each BASE_USDC_EXCHANGES as exchange (exchange.name)}
						<li class="flex h-7 items-center justify-between gap-3 text-sm">
							<span class="text-(--text-body)">{exchange.name}</span>
							<span class="text-(--text-muted)">{exchange.fee}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelLabel="Done">
		{#snippet primaryAction()}
			<Chip
				variant="primary"
				leftIcon={clipboard.copied ? Check : Copy}
				onclick={() => void clipboard.copy(address)}
			>
				{clipboard.label('Copy address')}
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
