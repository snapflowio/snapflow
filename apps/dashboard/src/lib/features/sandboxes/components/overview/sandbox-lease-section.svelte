<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { LeaseRenewalState, PlacementKind } from '@snapflow/api-client';

const PLACEMENT_KIND_LABELS: Record<PlacementKind, string> = {
	[PlacementKind.Pinned]: 'Specific machine',
	[PlacementKind.Flexible]: 'Any matching machine',
};
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { sandboxLeaseQueryOptions } from '#lib/api/sandboxes/sandboxes.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import {
	BINARY_UNITS_NOTE,
	formatEgressPrice,
	formatEgressPricePerTerabyte,
} from '#lib/features/billing/lib/transfer.ts';
import { formatResourceShape } from '#lib/features/listings/lib/listing-format.ts';
import { formatDate, formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice, platformFeeLabel } from '#lib/utils/usd.ts';
import LeaseRenewalNotice from './lease-renewal-notice.svelte';

interface SandboxLeaseSectionProps {
	canWrite: boolean;
	sandboxId: string;
}

let { canWrite, sandboxId }: SandboxLeaseSectionProps = $props();

const leaseQuery = createQuery(() => sandboxLeaseQueryOptions(sandboxId));
</script>

{#snippet row(
	rowLabel: string,
	rowValue: string,
	rowDetail?: string,
	valueClass?: string
)}
	<KeyValueRow detail={rowDetail ? detail : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			<span class={['block', valueClass]}>{rowValue}</span>
		{/snippet}
	</KeyValueRow>
	{#snippet detail()}
		{rowDetail}
	{/snippet}
{/snippet}

{#if !leaseQuery.isSuccess}
	<SettingsSection title="Lease">
		<FeedbackState
			class="min-h-0 py-4"
			message={leaseQuery.isPending ? 'Loading...' : 'No active lease'}
		/>
	</SettingsSection>
{:else}
	{const lease = $derived(leaseQuery.data)}
	{const renewalRequired = $derived(
		lease.renewalState === LeaseRenewalState.RenewalRequired
	)}
	<SettingsSection
		title="Lease"
		description={lease.priceCardId === null
			? 'Runs on a machine of your organization and is not billed for compute.'
			: `${platformFeeLabel(lease.markupBasisPoints)}. Later price increases need your consent.`}
	>
		<div class="flex flex-col gap-3">
			{#if renewalRequired}
				<LeaseRenewalNotice {canWrite} {lease} {sandboxId} />
			{/if}
			<KeyValueList>
				{@render row(
					'Locked price',
					formatHourlyPrice(lease.hourlyPriceMicroUsd),
					`Host ${formatHourlyPrice(lease.hostHourlyMicroUsd)} · fee ${formatHourlyPrice(lease.markupHourlyMicroUsd)}`
				)}
				{@render row(
					'While stopped',
					formatHourlyPrice(lease.stoppedHourlyPriceMicroUsd)
				)}
				<KeyValueRow>
					{#snippet label()}
						Locked until
					{/snippet}
					{#snippet value()}
						<span class="flex items-center justify-end gap-2">
							{formatDate(lease.priceLockedUntil)}
							<Badge
								size="sm"
								variant={renewalRequired ? 'amber' : 'gray-secondary'}
							>
								{renewalRequired ? 'Renewal required' : 'Renews automatically'}
							</Badge>
						</span>
					{/snippet}
				</KeyValueRow>
				{@render row('Placement', PLACEMENT_KIND_LABELS[lease.placementKind])}
				{@render row(
					'Machine',
					lease.machineId,
					undefined,
					'break-all font-mono text-caption'
				)}
				{@render row('Shape', formatResourceShape(lease))}
				{@render row(
					'Price cap',
					lease.maxHourlyPriceMicroUsd === null
						? 'None'
						: formatHourlyPrice(lease.maxHourlyPriceMicroUsd),
					'Renewals within the cap are accepted automatically'
				)}
				{@render row(
					'Egress',
					formatEgressPrice(lease.egressMicroUsdPerGiB),
					`${formatEgressPricePerTerabyte(lease.egressMicroUsdPerGiB)} · ingress free · ${BINARY_UNITS_NOTE}`
				)}
				{@render row(
					'Egress cap',
					lease.maxEgressMicroUsdPerGiB === null
						? 'None'
						: formatEgressPrice(lease.maxEgressMicroUsdPerGiB)
				)}
				{@render row('Started', formatDateTime(lease.startedAt))}
			</KeyValueList>
		</div>
	</SettingsSection>
{/if}
