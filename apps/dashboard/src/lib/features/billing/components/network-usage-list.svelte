<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { NetworkUsagePeriod } from '@snapflow/api-client';
import type { NetworkUsageParty } from '#lib/api/billing/usage.ts';
import { sandboxUsageTitle } from '#lib/features/billing/lib/billing-usage.ts';

const SUMMARY = {
	customer: 'Egress is billed hourly at the host’s price. Ingress is free.',
	host: 'Egress your machines carried for customers, with what you earned.',
} as const satisfies Record<NetworkUsageParty, string>;

function amountOf(period: NetworkUsagePeriod, party: NetworkUsageParty) {
	return party === 'customer' ? period.grossMicroUsd : period.hostMicroUsd;
}
</script>

<script lang="ts">
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { networkUsageInfiniteQueryOptions } from '#lib/api/billing/usage.ts';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import { formatObservedAt } from '#lib/features/billing/lib/format.ts';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import { formatTransferBytes } from '#lib/features/billing/lib/transfer.ts';
import {
	usagePeriodSearchSchema,
	usageWindow,
} from '#lib/features/billing/lib/usage-period.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import UsageList from './usage-list.svelte';
import UsagePeriodPicker from './usage-period-picker.svelte';
import UsageRow from './usage-row.svelte';

interface NetworkUsageListProps {
	party: NetworkUsageParty;
}

let { party }: NetworkUsageListProps = $props();

const params = new SearchParams(usagePeriodSearchSchema);
const range = $derived(usageWindow(params.current));
const query = createInfiniteQuery(() => ({
	...networkUsageInfiniteQueryOptions(party, {
		limit: CURSOR_PAGE_SIZE,
		...range,
	}),
	initialPageParam: {},
	getNextPageParam: nextCursorPage,
	placeholderData: keepPreviousData,
}));
const periods = $derived(cursorPageItems(query.data));
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-between gap-3">
		<span class="min-w-0 truncate text-(--text-muted) text-small">
			{SUMMARY[party]}
		</span>
		<UsagePeriodPicker
			selection={params.current}
			onChange={(selection) => void params.update(selection)}
		/>
	</div>
	<UsageList
		label="Network transfer"
		count={periods.length}
		isLoading={query.isLoading}
		isError={query.isError}
		isRetrying={query.isFetching}
		onRetry={() => void query.refetch()}
		loadingMessage="Loading network transfer..."
		errorMessage="Couldn't load network transfer."
		emptyMessage="No network transfer in this period."
		dimmed={query.isPlaceholderData}
		hasMore={query.hasNextPage}
		loadingMore={query.isFetchingNextPage}
		onLoadMore={() => void query.fetchNextPage()}
	>
		{#each periods as period (period.id)}
			<UsageRow>
				<span class="w-37.5 shrink-0 text-(--text-muted) text-caption">
					{formatObservedAt(new Date(period.periodStart))}
				</span>
				<TerminalWindow class="size-3.5 shrink-0 text-(--text-icon)" />
				<span class="min-w-0 flex-1 truncate text-(--text-body) text-sm">
					{sandboxUsageTitle(period)}
				</span>
				<span class="shrink-0 text-(--text-muted) text-caption tabular-nums">
					{formatTransferBytes(period.billedEgressBytes)}
					out
				</span>
				<span
					class="w-23 shrink-0 text-right text-(--text-muted) text-caption tabular-nums"
				>
					{formatUsd(amountOf(period, party))}
				</span>
			</UsageRow>
		{/each}
	</UsageList>
</div>
