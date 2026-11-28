<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const CHARGE_SKELETON_ROWS = 6;
</script>

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import Receipt from '@lucide/svelte/icons/receipt';
import PanelSection from '#lib/components/detail/panel-section.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import ChargeDetailsModal from '#lib/features/billing/components/details/charge-details-modal.svelte';
import {
	isPendingEvidence,
	BILLING_EVIDENCE_PENDING_LABEL as VERIFYING_LABEL,
} from '#lib/features/billing/lib/billing-evidence.ts';
import { formatServiceWindow } from '#lib/features/billing/lib/billing-usage.ts';
import { formatObservedAt } from '#lib/features/billing/lib/format.ts';
import type { UsageWindow } from '#lib/features/billing/lib/usage-period.ts';
import { SandboxUsageCharges } from '#lib/features/billing/state/sandbox-usage-charges.svelte.ts';
import { titleCase } from '#lib/utils/text.ts';

interface SandboxUsageChargesViewProps {
	sandboxId: string;
	range: UsageWindow;
}

let { sandboxId, range }: SandboxUsageChargesViewProps = $props();

const usage = new SandboxUsageCharges(
	() => sandboxId,
	() => range
);

const summary = $derived(usage.summaryQuery.data);
const charges = $derived(usage.chargesQuery);
</script>

<div class="flex flex-col">
	<PanelSection>
		{#if summary}
			<KeyValueList framed={false}>
				<KeyValueRow label="Total">
					<Money microUsd={summary.totalMicroUsd} />
				</KeyValueRow>
				<KeyValueRow
					label="Billed"
					value={formatServiceWindow(
						summary.firstServiceStart,
						summary.lastServiceThrough
					)}
				/>
				<KeyValueRow
					label="Sandbox ID"
					mono
					value={summary.sandboxId}
					copy={summary.sandboxId}
				/>
			</KeyValueList>
		{:else if usage.summaryQuery.isError}
			<FeedbackState
				variant="inline"
				tone="error"
				resource="this sandbox's usage"
				error={usage.summaryQuery.error}
				retrying={usage.summaryQuery.isFetching}
				onRetry={() => void usage.summaryQuery.refetch()}
			/>
		{:else}
			<Skeleton class="h-7" repeat={SKELETON_SECTION_ROWS} fade />
		{/if}
	</PanelSection>
	<PanelSection title="Charges">
		{#if charges.isSuccess}
			{#if usage.charges.length > 0}
				<ul
					aria-label="Charges"
					class={[
						'-mx-2 flex flex-col',
						charges.isPlaceholderData && 'opacity-50 transition-opacity',
					]}
				>
					{#each usage.charges as line (line.id)}
						{const label = $derived(titleCase(line.resourceSku))}
						<li>
							<button
								type="button"
								aria-label={`Open ${label.toLowerCase()} charge`}
								class="flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left outline-none hover-hover:bg-surface-hover focus-visible:focus-ring-inset"
								onclick={() => usage.panel.open(line.id)}
							>
								<span
									class="w-28 shrink-0 font-mono text-(--text-muted) text-xs"
								>
									{formatObservedAt(new Date(line.periodStart))}
								</span>
								<span
									class="min-w-0 flex-1 truncate text-(--text-body) text-sm"
								>
									{label}
								</span>
								{#if isPendingEvidence(line.evidenceStatus)}
									<span class="shrink-0 text-(--text-muted) text-xs">
										{VERIFYING_LABEL}
									</span>
								{/if}
								<Money
									class="shrink-0 text-(--text-secondary) text-sm"
									microUsd={line.effectiveMicroUsd}
								/>
								<ChevronRight class="size-4 shrink-0 text-(--text-icon)" />
							</button>
						</li>
					{/each}
				</ul>
				{#if charges.hasNextPage}
					<Chip
						variant="secondary"
						fullWidth
						class="mt-1 justify-center"
						loading={charges.isFetchingNextPage}
						onclick={() => void charges.fetchNextPage()}
					>
						Load more
					</Chip>
				{/if}
			{:else}
				<EmptyState icon={Receipt} title="No charges in this period" />
			{/if}
		{:else if charges.isError}
			<FeedbackState
				variant="inline"
				tone="error"
				resource="charges"
				error={charges.error}
				retrying={charges.isFetching}
				onRetry={() => void charges.refetch()}
			/>
		{:else}
			<Skeleton class="h-9" repeat={CHARGE_SKELETON_ROWS} fade />
		{/if}
	</PanelSection>
</div>
<ChargeDetailsModal line={usage.panel.row} onClose={usage.panel.close} />
