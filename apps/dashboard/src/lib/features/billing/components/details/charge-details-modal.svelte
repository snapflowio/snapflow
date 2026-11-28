<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { BillingLineItemDto } from '@snapflow/api-client';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChargeDetails from './charge-details.svelte';

interface ChargeDetailsModalProps {
	line: BillingLineItemDto | null;
	onClose: () => void;
}

let { line, onClose }: ChargeDetailsModalProps = $props();
</script>

<ChipModal
	open={line !== null}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
	srTitle="Charge details"
	size="lg"
>
	<ChipModalHeader {onClose}>Charge details</ChipModalHeader>
	<ChipModalBody>
		{#if line}
			<ChargeDetails {line} />
		{/if}
	</ChipModalBody>
</ChipModal>
