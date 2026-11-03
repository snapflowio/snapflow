<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type {
	AdminListing,
	MachineTier,
	UpdateAdminMachineTier,
} from '@snapflow/api-client';
import {
	MACHINE_TIER_LABELS,
	MACHINE_TIER_ORDER,
} from '#lib/features/listings/lib/listing-format.ts';

const NO_CAP = 'none';
const CAP_OPTIONS = [
	{ label: 'No cap', value: NO_CAP },
	...MACHINE_TIER_ORDER.map((tier) => ({
		label: MACHINE_TIER_LABELS[tier],
		value: tier,
	})),
];

function tierCapValue(value: string): MachineTier | null {
	return MACHINE_TIER_ORDER.find((tier) => tier === value) ?? null;
}

interface MachineTierModalProps {
	listing: AdminListing | null;
	pending: boolean;
	onSave: (listing: AdminListing, change: UpdateAdminMachineTier) => void;
	onClose: () => void;
}
</script>

<script lang="ts">
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import Label from '#lib/components/ui/label.svelte';
import Switch from '#lib/components/ui/switch.svelte';

let { listing, pending, onSave, onClose }: MachineTierModalProps = $props();

const fieldId = $props.id();
const capId = `${fieldId}-cap`;
const approvedId = `${fieldId}-approved`;
const reasonId = `${fieldId}-reason`;
let cap = $derived<string>(listing?.adminTierCap ?? NO_CAP);
let datacenterApproved = $derived(Boolean(listing?.datacenterApprovedAt));
let reason = $derived.by(() => {
	void listing;
	return '';
});
const disabled = $derived(pending || !reason.trim());

function submit() {
	if (!listing || disabled) return;
	onSave(listing, {
		tierCap: tierCapValue(cap),
		datacenterApproved,
		reason: reason.trim(),
	});
}

function setOpen(open: boolean) {
	if (!open) onClose();
}
</script>

<ChipModal
	bind:open={() => listing !== null, setOpen}
	onsubmit={submit}
	srTitle="Edit tier"
	dismissDisabled={pending}
>
	<ChipModalHeader {onClose} closeDisabled={pending}>
		Edit tier
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label="Tier cap"
			for={capId}
			hint="The machine never holds a tier above its cap."
		>
			<ChipDropdown
				id={capId}
				fullWidth
				align="start"
				options={CAP_OPTIONS}
				bind:value={cap}
			/>
		</ChipModalField>
		<div class="flex items-center justify-between gap-4 px-2">
			<div class="flex min-w-0 flex-col gap-1">
				<Label for={approvedId}>Approved for the Datacenter tier</Label>
				<p class="text-(--text-muted) text-caption">
					Datacenter tier also requires the Verified criteria.
				</p>
			</div>
			<Switch id={approvedId} bind:checked={datacenterApproved} />
		</div>
		<ChipModalField label="Reason" for={reasonId} required>
			<ChipInput
				id={reasonId}
				placeholder="Recorded in the audit log"
				bind:value={reason}
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={onClose} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<ChipModalAction type="submit" variant="primary" {disabled}>
				{pending ? 'Saving...' : 'Save'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
