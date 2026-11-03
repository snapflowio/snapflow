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
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import BillingHeading from '#lib/features/billing/components/billing-heading.svelte';
import ChargeDetailsModal from '#lib/features/billing/components/details/charge-details-modal.svelte';
import UsageList from '#lib/features/billing/components/usage-list.svelte';
import UsagePeriodPicker from '#lib/features/billing/components/usage-period-picker.svelte';
import UsageRow from '#lib/features/billing/components/usage-row.svelte';
import {
	isPendingEvidence,
	BILLING_EVIDENCE_PENDING_LABEL as VERIFYING_LABEL,
} from '#lib/features/billing/lib/billing-evidence.ts';
import { formatServiceWindow } from '#lib/features/billing/lib/billing-usage.ts';
import { formatObservedAt } from '#lib/features/billing/lib/format.ts';
import type { SandboxUsageCharges } from '#lib/features/billing/state/sandbox-usage-charges.svelte.ts';
import { titleCase } from '#lib/utils/text.ts';
import { formatUsd } from '#lib/utils/usd.ts';

let { usage }: { usage: SandboxUsageCharges } = $props();
</script>

{#snippet periodPicker()}
	<UsagePeriodPicker selection={usage.selection} onChange={usage.select} />
{/snippet}

<ResourceHeader breadcrumbs={usage.breadcrumbs} />
<PageColumn>
	{#if usage.summaryQuery.data}
		{const summary = $derived(usage.summaryQuery.data)}
		<BillingHeading
			icon={TerminalWindow}
			title={usage.title}
			detail={`${formatUsd(summary.totalMicroUsd)} total · Compute ${formatUsd(summary.computeMicroUsd)} · Network ${formatUsd(summary.networkMicroUsd)} · ${formatServiceWindow(summary.firstServiceStart, summary.lastServiceThrough)}`}
		/>
	{/if}
	<SettingsSection title="Charges" action={periodPicker}>
		<UsageList
			label="Charges"
			count={usage.charges.length}
			isLoading={usage.chargesQuery.isLoading}
			isError={usage.chargesQuery.isError}
			isRetrying={usage.chargesQuery.isFetching}
			onRetry={() => void usage.chargesQuery.refetch()}
			loadingMessage="Loading charges..."
			errorMessage="Couldn't load charges."
			emptyMessage="No charges in this period."
			dimmed={usage.chargesQuery.isPlaceholderData}
			hasMore={usage.chargesQuery.hasNextPage}
			loadingMore={usage.chargesQuery.isFetchingNextPage}
			onLoadMore={() => void usage.chargesQuery.fetchNextPage()}
		>
			{#each usage.charges as line (line.id)}
				{const label = $derived(titleCase(line.chargeClass))}
				<UsageRow
					onSelect={() => usage.panel.open(line.id)}
					selectLabel={`Open ${label.toLowerCase()} charge`}
				>
					<span class="w-37.5 shrink-0 text-(--text-muted) text-caption">
						{formatObservedAt(new Date(line.periodStart))}
					</span>
					<span class="min-w-0 flex-1 truncate text-(--text-body) text-sm">
						{label}
					</span>
					{#if isPendingEvidence(line.evidenceStatus)}
						<span class="shrink-0 text-(--text-muted) text-caption">
							{VERIFYING_LABEL}
						</span>
					{/if}
					<span
						class="w-23 shrink-0 text-right text-(--text-muted) text-caption tabular-nums"
					>
						{formatUsd(line.effectiveMicroUsd)}
					</span>
				</UsageRow>
			{/each}
		</UsageList>
	</SettingsSection>
</PageColumn>
<ChargeDetailsModal line={usage.panel.row} onClose={usage.panel.close} />
