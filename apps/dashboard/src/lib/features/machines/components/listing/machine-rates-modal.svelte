<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HostMachine } from '@snapflow/api-client';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import MachinePriceForm from './machine-price-form.svelte';

interface MachineRatesModalProps {
	machine: HostMachine | null;
	onClose: () => void;
}

let { machine, onClose }: MachineRatesModalProps = $props();
</script>

<ChipModal
	open={machine !== null}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
	srTitle="Edit rates"
	variant="sheet"
>
	<ChipModalHeader {onClose}>Edit rates</ChipModalHeader>
	{#if machine}
		<MachinePriceForm {machine} {onClose} />
	{/if}
</ChipModal>
