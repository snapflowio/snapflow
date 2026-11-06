<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import PaymentChannelDetails from './payment-channel-details.svelte';

interface PaymentChannelDetailsModalProps {
	channelId: string | null;
	onClose: () => void;
}

let { channelId, onClose }: PaymentChannelDetailsModalProps = $props();
</script>

<ChipModal
	open={channelId !== null}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
	srTitle="Payment channel"
	size="lg"
>
	<ChipModalHeader {onClose}>Payment channel</ChipModalHeader>
	<ChipModalBody>
		{#if channelId}
			{#key channelId}
				<PaymentChannelDetails {channelId} />
			{/key}
		{/if}
	</ChipModalBody>
</ChipModal>
