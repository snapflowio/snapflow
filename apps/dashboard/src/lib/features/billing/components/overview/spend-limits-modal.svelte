<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import type { BudgetMode } from '#lib/features/billing/state/budget-draft.svelte.ts';

const BUDGET_MODE_OPTIONS = [
	{ label: 'Warn only', value: 'alert' },
	{ label: 'Block new sandboxes', value: 'block_new' },
] as const satisfies readonly ChipOption<BudgetMode>[];
const INVALID_AMOUNT_MESSAGE =
	'Enter limits as dollar amounts, like 50 or 12.50.';
</script>

<script lang="ts">
import type { BillingBudgetDto } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { updateBillingBudgetMutationOptions } from '#lib/api/billing/billing.ts';
import { ifMatchHeaders } from '#lib/api/client/api-client.ts';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { BudgetDraft } from '#lib/features/billing/state/budget-draft.svelte.ts';

interface SpendLimitsModalProps {
	open?: boolean;
	budget: BillingBudgetDto;
}

let { open = $bindable(false), budget }: SpendLimitsModalProps = $props();

const fieldId = $props.id();
const ids = {
	monthly: `${fieldId}-monthly`,
	network: `${fieldId}-network`,
	runway: `${fieldId}-runway`,
	warning: `${fieldId}-warning`,
};
const draft = new BudgetDraft(() => budget);
const save = createMutation(() => updateBillingBudgetMutationOptions());
let failure = $state<string | null>(null);

watch(
	() => open,
	(isOpen) => {
		if (!isOpen) return;
		draft.discard();
		failure = null;
	}
);

function close(): void {
	if (save.isPending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	if (!draft.dirty || save.isPending) return;
	const body = draft.body();
	if (!body) {
		failure = INVALID_AMOUNT_MESSAGE;
		return;
	}
	save.mutate(
		{ body, headers: ifMatchHeaders(draft.resourceVersion) },
		{
			onSuccess: () => {
				open = false;
			},
		}
	);
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

{#snippet minutesSuffix()}
	<ChipInputSuffix>min</ChipInputSuffix>
{/snippet}

{#snippet percentSuffix()}
	<ChipInputSuffix>%</ChipInputSuffix>
{/snippet}

<ChipModal
	bind:open
	dismissDisabled={save.isPending}
	srTitle="Spend limits"
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={save.isPending}>
		Spend limits
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Monthly limit" for={ids.monthly}>
			<ChipInput
				id={ids.monthly}
				required
				inputmode="decimal"
				bind:value={draft.monthly}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField
			label="Network limit"
			for={ids.network}
			hint="Egress only. Running sandboxes are throttled when it is reached."
		>
			<ChipInput
				id={ids.network}
				inputmode="decimal"
				placeholder="No limit"
				bind:value={draft.network}
				startAdornment={dollarPrefix}
			/>
		</ChipModalField>
		<ChipModalField label="When a limit is reached">
			<ChipDropdown
				aria-label="When a limit is reached"
				fullWidth
				options={BUDGET_MODE_OPTIONS}
				value={draft.mode}
				onChange={(mode: BudgetMode) => {
					draft.mode = mode;
				}}
			/>
		</ChipModalField>
		<ChipModalField
			label="Warn at"
			for={ids.warning}
			hint="Share of a limit that triggers a warning."
		>
			<ChipInput
				id={ids.warning}
				required
				type="number"
				min="1"
				max="100"
				step="1"
				bind:value={draft.warning}
				endAdornment={percentSuffix}
			/>
		</ChipModalField>
		<ChipModalField
			label="Low credit warning"
			for={ids.runway}
			hint="Warn when credit covers less than this much usage."
		>
			<ChipInput
				id={ids.runway}
				required
				type="number"
				min="1"
				step="1"
				bind:value={draft.runway}
				endAdornment={minutesSuffix}
			/>
		</ChipModalField>
		<ChipModalError message={failure} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={save.isPending}>
		{#snippet primaryAction()}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={!draft.dirty || save.isPending}
			>
				{save.isPending ? 'Saving...' : 'Save'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
