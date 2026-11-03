<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import BillingHeader from '#lib/features/billing/components/billing-header.svelte';
import UsageExport from '#lib/features/billing/components/usage-export.svelte';
import UsageList from '#lib/features/billing/components/usage-list.svelte';
import UsagePeriodPicker from '#lib/features/billing/components/usage-period-picker.svelte';
import UsageRow from '#lib/features/billing/components/usage-row.svelte';
import { BILLING_EVIDENCE_PENDING_LABEL as VERIFYING_LABEL } from '#lib/features/billing/lib/billing-evidence.ts';
import {
	DELETED_SANDBOX_LABEL,
	sandboxUsageSharePercent,
	sandboxUsageTitle,
} from '#lib/features/billing/lib/billing-usage.ts';
import { SandboxUsageList } from '#lib/features/billing/state/sandbox-usage-list.svelte.ts';
import { formatUsd } from '#lib/utils/usd.ts';

const list = new SandboxUsageList();
const query = list.query;
</script>

{#snippet exportMenu()}
	<UsageExport
		disabled={list.usage.length === 0 || query.isPlaceholderData}
		period={list.selection.period}
		range={list.range}
	/>
{/snippet}

<BillingHeader trailing={exportMenu} />
<PageColumn>
	<div class="flex flex-col gap-3">
		<div class="flex items-center justify-between gap-3">
			<span class="text-(--text-muted) text-small tabular-nums">
				Total: {list.totalLabel}
			</span>
			<UsagePeriodPicker selection={list.selection} onChange={list.select} />
		</div>
		<UsageList
			label="Usage by sandbox"
			count={list.usage.length}
			isLoading={query.isLoading}
			isError={query.isError}
			isRetrying={query.isFetching}
			onRetry={() => void query.refetch()}
			loadingMessage="Loading usage..."
			errorMessage="Couldn't load usage."
			emptyMessage="No usage in this period."
			dimmed={query.isPlaceholderData}
			hasMore={query.hasNextPage}
			loadingMore={query.isFetchingNextPage}
			onLoadMore={() => void query.fetchNextPage()}
		>
			{#each list.usage as row (row.sandboxId)}
				{const title = $derived(sandboxUsageTitle(row))}
				<UsageRow
					href={list.sandboxHref(row.sandboxId)}
					selectLabel={`Open ${title}`}
				>
					<TerminalWindow class="size-3.5 shrink-0 text-(--text-icon)" />
					<span class="min-w-0 flex-1 truncate text-(--text-body) text-sm">
						{title}
					</span>
					{#if !row.sandboxName}
						<span class="shrink-0 text-(--text-muted) text-caption">
							{DELETED_SANDBOX_LABEL}
						</span>
					{/if}
					{#if row.evidence.pending > 0}
						<span class="shrink-0 text-(--text-muted) text-caption">
							{VERIFYING_LABEL}
						</span>
					{/if}
					<div
						aria-hidden="true"
						class="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-border"
					>
						<div
							class="h-full rounded-full bg-brand-secondary"
							style:width={`${sandboxUsageSharePercent(row, list.totalMicroUsd)}%`}
						></div>
					</div>
					<span
						class="w-23 shrink-0 text-right text-(--text-muted) text-caption tabular-nums"
					>
						{formatUsd(row.totalMicroUsd)}
					</span>
				</UsageRow>
			{/each}
		</UsageList>
	</div>
</PageColumn>
