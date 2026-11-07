<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { ListingState, ListingVisibility } from '@snapflow/api-client';
import {
	LISTING_STATE_LABELS,
	LISTING_VISIBILITY_LABELS,
} from '#lib/features/listings/lib/listing-format.ts';

const STATE_TABS = Object.values(ListingState).map((state) => ({
	label: LISTING_STATE_LABELS[state],
	value: state,
}));
const VISIBILITY_TABS = Object.values(ListingVisibility).map((visibility) => ({
	label: LISTING_VISIBILITY_LABELS[visibility],
	value: visibility,
}));
const STATE_VALUES = new Set<string>(Object.values(ListingState));
const VISIBILITY_VALUES = new Set<string>(Object.values(ListingVisibility));

function isListingState(value: string): value is ListingState {
	return STATE_VALUES.has(value);
}

function isListingVisibility(value: string): value is ListingVisibility {
	return VISIBILITY_VALUES.has(value);
}
</script>

<script lang="ts">
import type { HostMachine } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { updateListingMutationOptions } from '#lib/api/listings.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

interface MachineListingFormProps {
	machine: HostMachine;
	onClose: () => void;
	payoutReady: boolean | undefined;
}

let { machine, onClose, payoutReady }: MachineListingFormProps = $props();

const updateListing = createMutation(() => updateListingMutationOptions());
const form = createAppForm(() => ({
	defaultValues: {
		state: machine.listing.state,
		visibility: machine.listing.visibility,
	},
	onSubmit: async ({ value }) => {
		if (
			await submitMutation(() =>
				updateListing.mutateAsync({ machine, listing: value })
			)
		) {
			onClose();
		}
	},
}));
const values = form.useStore((state) => state.values);
const listsPublicly = $derived(
	values.current.state === ListingState.Listed &&
		values.current.visibility === ListingVisibility.Public
);
const needsPrice = $derived(listsPublicly && !machine.currentPriceCard);
const needsPayout = $derived(listsPublicly && payoutReady === false);
</script>

<form class="contents" onsubmit={formSubmitHandler(form)}>
	<form.AppForm>
		<ChipModalBody>
			<ChipModalField
				label="State"
				hint="Listed machines take new sandboxes. Paused machines keep their running sandboxes."
			>
				<form.Field name="state">
					{#snippet children(
						field
					)}
						<ChipModalTabs
							aria-label="Listing state"
							tabs={STATE_TABS}
							value={field.state.value}
							onChange={(value) => {
								if (isListingState(value)) field.handleChange(value);
							}}
						/>
					{/snippet}
				</form.Field>
			</ChipModalField>
			<ChipModalField
				label="Visibility"
				hint="Private machines run only this organization’s sandboxes and are never billed."
			>
				<form.Field name="visibility">
					{#snippet children(
						field
					)}
						<ChipModalTabs
							aria-label="Listing visibility"
							tabs={VISIBILITY_TABS}
							value={field.state.value}
							onChange={(value) => {
								if (isListingVisibility(value)) field.handleChange(value);
							}}
						/>
					{/snippet}
				</form.Field>
			</ChipModalField>
			{#if needsPrice}
				<div class="px-2">
					<Notice tone="warning">
						{#snippet title()}
							Publish prices first
						{/snippet}
						{#snippet description()}
							A public listing needs a price card. Set this machine’s prices,
							then list it publicly.
						{/snippet}
					</Notice>
				</div>
			{/if}
			{#if needsPayout}
				<div class="px-2">
					<Notice tone="warning">
						{#snippet title()}
							Link a payout wallet first
						{/snippet}
						{#snippet description()}
							Public listings earn money, so they need a linked payout wallet
							that passed sanctions screening.
						{/snippet}
						{#snippet action()}
							<Chip variant="primary" href={resolve(Path.EARNINGS_PAYOUTS)}>
								Link payout wallet
							</Chip>
						{/snippet}
					</Notice>
				</div>
			{/if}
		</ChipModalBody>
		<ChipModalFooter onCancel={onClose}>
			{#snippet primaryAction(
				initialFocus
			)}
				<form.SubmitButton
					pendingLabel="Saving..."
					disabled={needsPrice || needsPayout}
					{@attach initialFocus}
				>
					Save
				</form.SubmitButton>
			{/snippet}
		</ChipModalFooter>
	</form.AppForm>
</form>
