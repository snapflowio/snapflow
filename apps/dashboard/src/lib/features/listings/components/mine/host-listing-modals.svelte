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
import MachineListingForm from './machine-listing-form.svelte';
import MachinePriceCardForm from './machine-price-card-form.svelte';

interface HostListingModalsProps {
	listing?: HostMachine | null;
	pricing?: HostMachine | null;
	payoutReady: boolean | undefined;
}

let {
	listing = $bindable(null),
	pricing = $bindable(null),
	payoutReady,
}: HostListingModalsProps = $props();

function closeListing(open: boolean): void {
	if (!open) listing = null;
}

function closePricing(open: boolean): void {
	if (!open) pricing = null;
}
</script>

<ChipModal
	bind:open={() => listing !== null, closeListing}
	srTitle="Edit listing"
>
	<ChipModalHeader onClose={() => (listing = null)}
		>Edit listing</ChipModalHeader
	>
	{#if listing}
		<MachineListingForm
			machine={listing}
			{payoutReady}
			onClose={() => (listing = null)}
		/>
	{/if}
</ChipModal>

<ChipModal
	bind:open={() => pricing !== null, closePricing}
	srTitle="Edit prices"
	size="lg"
>
	<ChipModalHeader onClose={() => (pricing = null)}
		>Edit prices</ChipModalHeader
	>
	{#if pricing}
		<MachinePriceCardForm machine={pricing} onClose={() => (pricing = null)} />
	{/if}
</ChipModal>
