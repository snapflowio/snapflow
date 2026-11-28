<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const NO_LIMIT_LABEL = 'No monthly limit';
</script>

<script lang="ts">
import type { BillingOverviewDto } from '@snapflow/api-client';
import Well from '#lib/components/detail/well.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Meter, {
	type MeterTone,
	QUOTA_WARNING_RATIO,
} from '#lib/components/ui/meter.svelte';
import Money from '#lib/components/ui/money.svelte';
import { hasMicroUsd } from '#lib/features/billing/lib/escrow-balance.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface MonthSpendWellProps {
	overview: BillingOverviewDto | undefined;
	canManage: boolean;
	onEditLimit: () => void;
}

let { overview, canManage, onEditLimit }: MonthSpendWellProps = $props();

const month = $derived(overview?.month);
const actual = $derived(month ? Number(month.actualMicroUsd) : 0);
const limitMicroUsd = $derived(month?.limitMicroUsd);
const limit = $derived(
	limitMicroUsd === undefined ? null : Number(limitMicroUsd)
);
const tone = $derived.by((): MeterTone => {
	if (limit === null) return 'default';
	if (actual >= limit) return 'error';
	return actual >= limit * QUOTA_WARNING_RATIO ? 'warning' : 'default';
});
const summary = $derived.by(() => {
	if (!month) return '';
	const parts = [
		hasMicroUsd(month.forecastMicroUsd)
			? `${formatUsd(month.forecastMicroUsd)} forecast`
			: null,
		limitMicroUsd === undefined
			? NO_LIMIT_LABEL
			: `limit ${formatUsd(limitMicroUsd)}`,
	].filter((part) => part !== null);
	return parts.join(' · ');
});
</script>

<Well title="This month" loading={!month}>
	{#snippet actions()}
		{#if canManage && month}
			<Chip variant="secondary" onclick={onEditLimit}>
				{limit === null ? 'Set limit' : 'Edit limit'}
			</Chip>
		{/if}
	{/snippet}
	{#if month}
		<Money class="heading-s" microUsd={month.actualMicroUsd} />
	{/if}
	{#snippet footer()}
		{#if month && limit !== null && limit > 0 && limitMicroUsd !== undefined}
			<Meter
				label="Spend against the monthly limit"
				value={actual}
				maximum={limit}
				{tone}
				valueText={`${formatUsd(month.actualMicroUsd)} of ${formatUsd(limitMicroUsd)}`}
			/>
		{/if}
		<p class="tabular-nums">{summary}</p>
	{/snippet}
</Well>
