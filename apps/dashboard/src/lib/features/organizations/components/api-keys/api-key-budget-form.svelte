<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ApiKeyBudget } from '@snapflow/api-client';
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import {
	apiKeyBudgetQueryKey,
	updateApiKeyBudgetMutationOptions,
} from '#lib/api/organizations/api-keys.ts';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { ApiKeyBudgetDraft } from '#lib/features/organizations/state/api-key-budget-draft.svelte.ts';
import { formatHourlyPrice, formatUsd } from '#lib/utils/usd.ts';

interface ApiKeyBudgetFormProps {
	budget: ApiKeyBudget;
	canEdit: boolean;
	onClose: () => void;
}

let { budget, canEdit, onClose }: ApiKeyBudgetFormProps = $props();

const fieldId = $props.id();
const ids = {
	spendLimit: `${fieldId}-spend-limit`,
	maxConcurrent: `${fieldId}-max-concurrent`,
};
const queryClient = useQueryClient();
const draft = new ApiKeyBudgetDraft(() => budget);
const save = createMutation(() => updateApiKeyBudgetMutationOptions());
const spent = $derived(
	budget.computeSpendLimitMicroUsd === null
		? formatUsd(budget.computeSpendMicroUsd)
		: `${formatUsd(budget.computeSpendMicroUsd)} / ${formatUsd(budget.computeSpendLimitMicroUsd)}`
);

export function submit(): void {
	const body = draft.body();
	if (!(canEdit && body) || save.isPending) return;
	save.mutate(
		{ path: { apiKeyId: budget.apiKeyId }, body },
		{
			onSuccess: (updated) => {
				queryClient.setQueryData(
					apiKeyBudgetQueryKey(updated.apiKeyId),
					updated
				);
				onClose();
			},
		}
	);
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

<ChipModalBody>
	{#if budget.exhausted}
		<Notice
			tone="error"
			title="This key is at its budget"
			info="New sandboxes it starts are refused, and its running sandboxes stop once the remaining budget would not cover their burn until the next check."
		/>
	{/if}
	<KeyValueList framed={false} label="Usage">
		<KeyValueRow
			align="end"
			label="Compute, last 30 days"
			info="Counts what this key's sandboxes cost while they run. Stopped sandbox disks bill the organization, not this key."
			value={spent}
		/>
		<KeyValueRow
			align="end"
			label="Compute burn"
			value={formatHourlyPrice(budget.computeBurnMicroUsdPerHour)}
		/>
		<KeyValueRow
			align="end"
			label="Running sandboxes"
			value={String(budget.runningSandboxes)}
		/>
	</KeyValueList>
	<ChipModalField label="Spend limit per 30 days" for={ids.spendLimit}>
		<ChipInput
			id={ids.spendLimit}
			inputmode="decimal"
			placeholder="No limit"
			disabled={!canEdit}
			bind:value={draft.spendLimit}
			startAdornment={dollarPrefix}
		/>
	</ChipModalField>
	<ChipModalField label="Sandboxes running at once" for={ids.maxConcurrent}>
		<ChipInput
			id={ids.maxConcurrent}
			inputmode="numeric"
			placeholder="No limit"
			disabled={!canEdit}
			bind:value={draft.maxConcurrent}
		/>
	</ChipModalField>
	<ChipModalError message={draft.error} />
</ChipModalBody>
<ChipModalFooter onCancel={onClose} cancelDisabled={save.isPending}>
	{#snippet primaryAction()}
		{#if canEdit}
			<Chip
				loading={save.isPending}
				type="submit"
				variant="primary"
				disabled={draft.error !== null || save.isPending}
			>
				Save
			</Chip>
		{/if}
	{/snippet}
</ChipModalFooter>
