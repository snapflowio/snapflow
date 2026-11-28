<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const OWN_MACHINE_INFO = 'Runs free on a machine of your organization.';
const STOPPED_RATE_INFO =
	'Charged per second while it runs. Its disk keeps a smaller charge while it is stopped on the host.';
const NOT_RUNNING_LABEL = 'Not running';
const FREE_LABEL = 'Free';
const EMPTY_VALUE = '—';
</script>

<script lang="ts">
import type { SandboxPrice } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { sandboxUsageSummaryQueryOptions } from '#lib/api/billing/usage.ts';
import ContextCard from '#lib/components/detail/context-card.svelte';
import StatisticCard from '#lib/components/detail/statistic-card.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import { sandboxChargesHref } from '#lib/features/sandboxes/lib/sandbox-cost.ts';
import type { SandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { platformFeeLabel } from '#lib/utils/usd.ts';

interface SandboxCostSectionProps {
	detail: SandboxDetail;
	price: SandboxPrice | undefined;
}

let { detail, price }: SandboxCostSectionProps = $props();

const sandbox = $derived(detail.sandbox);
const usageQuery = createQuery(() => ({
	...sandboxUsageSummaryQueryOptions(sandbox.id),
	enabled: detail.canReadBilling,
	retry: false,
}));
const free = $derived(price?.priceCardId === null);
const rateInfo = $derived.by(() => {
	if (!price) return undefined;
	if (free) return OWN_MACHINE_INFO;
	return `${STOPPED_RATE_INFO} ${platformFeeLabel(price.markupBasisPoints)}.`;
});
</script>

{#snippet costActions()}
	{#if detail.canReadBilling}
		<Chip size="compact" variant="ghost" href={sandboxChargesHref(sandbox.id)}>
			View charges
		</Chip>
	{/if}
{/snippet}

<ContextCard title="Cost" action={costActions}>
	<div class="grid grid-cols-2 gap-x-6 gap-y-4">
		<StatisticCard label="Current rate" info={rateInfo}>
			{#if !price}
				<span class="text-(--text-muted)">{NOT_RUNNING_LABEL}</span>
			{:else if free}
				{FREE_LABEL}
			{:else}
				<Money microUsd={price.hourlyPriceMicroUsd} unit="/h" />
			{/if}
		</StatisticCard>
		{#if detail.canReadBilling}
			<StatisticCard label="Cost so far">
				{#if usageQuery.data}
					<Money microUsd={usageQuery.data.totalMicroUsd} />
				{:else}
					<span class="text-(--text-subtle)">{EMPTY_VALUE}</span>
				{/if}
			</StatisticCard>
		{/if}
	</div>
	{#if price && !free && price.maxHourlyPriceMicroUsd !== null}
		<KeyValueList framed={false} label="Pricing">
			<KeyValueRow label="Max price">
				<Money microUsd={price.maxHourlyPriceMicroUsd} unit="/h" />
			</KeyValueRow>
		</KeyValueList>
	{/if}
</ContextCard>
