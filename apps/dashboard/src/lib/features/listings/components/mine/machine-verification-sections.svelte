<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import type { Snippet } from 'svelte';
import { machineVerificationQueryOptions } from '#lib/api/listings.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import {
	MACHINE_TIER_LABELS,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import {
	formatBasisPointsPercent,
	formatCount,
	formatDateTime,
	formatOptionalDateTime,
} from '#lib/utils/format.ts';

interface MachineVerificationSectionsProps {
	machineId: string;
}

let { machineId }: MachineVerificationSectionsProps = $props();

const verification = createQuery(() =>
	machineVerificationQueryOptions(machineId)
);
</script>

{#snippet textRow(
	rowLabel: string,
	rowValue: string,
	rowDetail?: string
)}
	<KeyValueRow detail={rowDetail ? detailText : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
	{#snippet detailText()}
		{rowDetail}
	{/snippet}
{/snippet}

{#snippet contentRow(
	rowLabel: string,
	rowValue: Snippet,
	rowDetail?: string
)}
	<KeyValueRow value={rowValue} detail={rowDetail ? detailText : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
	</KeyValueRow>
	{#snippet detailText()}
		{rowDetail}
	{/snippet}
{/snippet}

{#snippet checkBadge(
	met: boolean
)}
	<Badge size="sm" variant={met ? 'green' : 'gray-secondary'}>
		{met ? 'Met' : 'Not met'}
	</Badge>
{/snippet}

{#if verification.isSuccess}
	{const current = $derived(verification.data)}
	{const checklist = $derived(current.checklist)}
	{const latestBenchmark = $derived(current.latestBenchmark)}
	{#snippet tierBadge()}
		<Badge size="sm" variant={tierBadgeVariant(current.tier)}>
			{MACHINE_TIER_LABELS[current.tier]}
		</Badge>
	{/snippet}
	{#snippet payoutWallet()}
		{@render checkBadge(checklist.payoutWallet)}
	{/snippet}
	{#snippet benchmark()}
		{@render checkBadge(checklist.benchmark)}
	{/snippet}
	{#snippet fingerprint()}
		{@render checkBadge(checklist.fingerprintUnique)}
	{/snippet}
	{#snippet network()}
		{@render checkBadge(checklist.networkMinimum)}
	{/snippet}
	{#snippet disk()}
		{@render checkBadge(checklist.diskMinimum)}
	{/snippet}
	{#snippet stateBadge()}
		{#if latestBenchmark}
			<ResourceStateBadge state={latestBenchmark.state} />
		{/if}
	{/snippet}
	<SettingsSection
		title="Tier"
		description="Tiers are earned from a linked payout wallet, benchmarks, uptime and spot checks."
	>
		<KeyValueList>
			{@render contentRow('Current tier', tierBadge)}
			{#each current.reasons as reason (reason)}
				{@render textRow('Reason', reason)}
			{/each}
		</KeyValueList>
	</SettingsSection>
	<SettingsSection title="Checklist">
		<KeyValueList>
			{@render contentRow('Payout wallet linked', payoutWallet)}
			{@render contentRow(
				'Benchmark passed',
				benchmark,
				'For the current hardware inventory'
			)}
			{@render contentRow('Unique hardware', fingerprint)}
			{@render contentRow('Network minimum', network)}
			{@render contentRow('Disk minimum', disk)}
			{@render textRow('Days listed', formatCount(checklist.listedDays))}
			{@render textRow(
				'30-day uptime',
				formatBasisPointsPercent(checklist.uptimeBasisPoints)
			)}
			{@render textRow(
				'Spot checks passed',
				formatCount(checklist.spotChecksPassed30d),
				'Last 30 days'
			)}
		</KeyValueList>
	</SettingsSection>
	<SettingsSection title="Latest benchmark">
		{#if latestBenchmark}
			<KeyValueList>
				{@render contentRow('State', stateBadge)}
				{@render textRow(
					'Issued',
					formatDateTime(latestBenchmark.issuedAt),
					`Suite v${latestBenchmark.suiteVersion}`
				)}
				{@render textRow(
					'Completed',
					formatOptionalDateTime(latestBenchmark.completedAt, 'Not completed')
				)}
				{#each latestBenchmark.failureReasons as reason (reason)}
					{@render textRow('Failure', reason)}
				{/each}
			</KeyValueList>
		{:else}
			<FeedbackState variant="inline">
				Benchmarks run when the machine registers, when its hardware changes, or
				on request. The machine must be idle.
			</FeedbackState>
		{/if}
	</SettingsSection>
{:else if verification.isError}
	<FeedbackState
		variant="inline"
		tone="error"
		retrying={verification.isFetching}
		onRetry={() => void verification.refetch()}
	>
		Verification could not be loaded
	</FeedbackState>
{:else}
	<FeedbackState variant="inline">Loading verification...</FeedbackState>
{/if}
