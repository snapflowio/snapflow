<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { BillingOverviewDto } from '@snapflow/api-client';

const BUDGET_MODE_LABELS = {
	alert: 'Warn only',
	block_new: 'Block new sandboxes',
} as const;
const NO_LIMIT_LABEL = 'No limit';
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { billingBudgetQueryOptions } from '#lib/api/billing/billing.ts';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { budgetUsedPercent } from '#lib/features/billing/lib/billing-overview.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import SpendLimitsModal from './spend-limits-modal.svelte';
import SummaryRow from './summary-row.svelte';
import UsageMeter from './usage-meter.svelte';

interface SpendLimitsSectionProps {
	overview: BillingOverviewDto;
	canManage: boolean;
	open?: boolean;
}

let {
	overview,
	canManage,
	open = $bindable(false),
}: SpendLimitsSectionProps = $props();

const budget = createQuery(() => billingBudgetQueryOptions());
</script>

{#snippet limitRow(
	label: string,
	breakdown: BillingOverviewDto['month']
)}
	{const percent = $derived(budgetUsedPercent(breakdown))}
	<SummaryRow {label}>
		{#if breakdown.limitMicroUsd === undefined}
			<span class="text-(--text-muted) text-small">{NO_LIMIT_LABEL}</span>
		{:else}
			<span class="flex min-w-0 items-center gap-2.5">
				{#if percent !== null}
					<UsageMeter {percent} />
				{/if}
				<span class="truncate text-(--text-muted) text-small tabular-nums">
					{`${formatUsd(breakdown.committedMicroUsd)} of ${formatUsd(breakdown.limitMicroUsd)}`}
				</span>
			</span>
		{/if}
	</SummaryRow>
{/snippet}

{#snippet editAction()}
	<Chip disabled={!budget.isSuccess} onclick={() => (open = true)}>Edit</Chip>
{/snippet}

<SettingsSection
	title="Spend limits"
	action={canManage ? editAction : undefined}
>
	<div class="flex flex-col gap-4">
		{@render limitRow('Monthly limit', overview.month)}
		{@render limitRow('Network limit', overview.network)}
		<SummaryRow
			label="When a limit is reached"
			value={budget.data
				? BUDGET_MODE_LABELS[budget.data.mode]
				: EMPTY_CELL_PLACEHOLDER}
		/>
	</div>
</SettingsSection>
{#if canManage && budget.data}
	<SpendLimitsModal bind:open budget={budget.data} />
{/if}
