<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Smartphone from '@lucide/svelte/icons/smartphone';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import QrCode from '#lib/components/ui/qr-code.svelte';

const PAIRING_QR_SIZE_PX = 220;
const TITLE = 'Connect a phone wallet';

interface WalletConnectModalProps {
	uri: string | null;
	onCancel: () => void;
}

let { uri, onCancel }: WalletConnectModalProps = $props();
</script>

<ChipModal
	open={uri !== null}
	onOpenChange={(open) => {
		if (!open) onCancel();
	}}
	srTitle={TITLE}
>
	<ChipModalHeader onClose={onCancel}>{TITLE}</ChipModalHeader>
	<ChipModalBody>
		{#if uri}
			<ChipModalField
				label="Scan with a WalletConnect wallet, such as MetaMask, Rainbow, Trust or Safe"
			>
				<QrCode
					value={uri}
					label="WalletConnect pairing QR code"
					size={PAIRING_QR_SIZE_PX}
				/>
			</ChipModalField>
			<div class="flex flex-wrap items-center gap-2">
				<Chip href={uri} leftIcon={Smartphone}>Open wallet app</Chip>
				<span class="text-(--text-muted) text-xs">
					On this phone? Open the wallet directly.
				</span>
			</div>
			<ChipCopyInput
				value={uri}
				class="font-mono"
				copyLabel="Copy pairing link"
				aria-label="WalletConnect pairing link"
			/>
		{/if}
	</ChipModalBody>
</ChipModal>
