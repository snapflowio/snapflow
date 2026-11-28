<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Gauge from '@lucide/svelte/icons/gauge';
import type { MachineVerification } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { MACHINE_TIER_LABELS } from '#lib/features/listings/lib/listing-format.ts';
import {
	benchmarkDeferralTitle,
	benchmarkExpired,
	benchmarkFailureTitle,
} from '#lib/features/listings/lib/machine-benchmark.ts';
import { VERIFICATION_CHECKS } from '#lib/features/machines/lib/machine-verification.ts';
import { formatBasisPointsPercent, formatCount } from '#lib/utils/format.ts';

interface MachineVerificationSectionsProps {
	verification: MachineVerification;
	canRequestBenchmark: boolean;
	requesting: boolean;
	onRequestBenchmark: () => void;
}

let {
	verification,
	canRequestBenchmark,
	requesting,
	onRequestBenchmark,
}: MachineVerificationSectionsProps = $props();

const checklist = $derived(verification.checklist);
const latestBenchmark = $derived(verification.latestBenchmark);
const benchmarkRequest = $derived(verification.benchmarkRequest);
</script>

{#snippet runBenchmark()}
	{#if canRequestBenchmark}
		<Chip
			size="compact"
			leftIcon={Gauge}
			loading={requesting}
			disabledReason={benchmarkRequest.available
				? undefined
				: (benchmarkRequest.message ?? undefined)}
			onclick={onRequestBenchmark}
		>
			Run benchmark
		</Chip>
	{/if}
{/snippet}

<div class="flex flex-col gap-8 pt-2">
	<SettingsSection
		title="Tier"
		info="Earned from a payout wallet, benchmarks, uptime and spot checks."
	>
		<KeyValueList framed={false}>
			<KeyValueRow
				label="Current tier"
				value={MACHINE_TIER_LABELS[verification.tier]}
			/>
			{#each verification.reasons as reason (reason)}
				<KeyValueRow label="Reason" value={reason} />
			{/each}
		</KeyValueList>
	</SettingsSection>
	<SettingsSection title="Checks">
		<KeyValueList framed={false}>
			{#each VERIFICATION_CHECKS as check (check.key)}
				{const met = $derived(checklist[check.key])}
				<KeyValueRow label={check.label}>
					<StatusLabel
						label={met ? 'Met' : 'Not met'}
						shape={met ? 'check' : 'empty'}
						tone={met ? 'success' : 'neutral'}
					/>
				</KeyValueRow>
			{/each}
			<KeyValueRow
				label="Days listed"
				value={formatCount(checklist.listedDays)}
			/>
			<KeyValueRow
				label="Uptime"
				info="Last 30 days"
				value={formatBasisPointsPercent(checklist.uptimeBasisPoints)}
			/>
			<KeyValueRow
				label="Spot checks passed"
				info="Last 30 days"
				value={formatCount(checklist.spotChecksPassed30d)}
			/>
		</KeyValueList>
	</SettingsSection>
	<SettingsSection
		title="Benchmark"
		info="Runs while the machine is idle: at registration, after hardware or release changes, before expiry, or on request."
		action={runBenchmark}
	>
		<div class="flex flex-col gap-3">
			{#if latestBenchmark?.deferral}
				<Notice
					tone="warning"
					title={benchmarkDeferralTitle(
						latestBenchmark.deferral,
						latestBenchmark.nextAttemptAt
					)}
					info={latestBenchmark.deferral.fix}
				/>
			{:else if latestBenchmark && latestBenchmark.failures.length > 0}
				{const failure = $derived(latestBenchmark.failures[0])}
				{#if failure}
					<Notice
						tone="error"
						title={benchmarkFailureTitle(failure)}
						info={failure.fix}
					/>
				{/if}
			{/if}
			<KeyValueList framed={false}>
				{#if latestBenchmark}
					<KeyValueRow label="State">
						<ResourceStateBadge state={latestBenchmark.state} />
					</KeyValueRow>
					<KeyValueRow
						label="Issued"
						info={`Suite v${latestBenchmark.suiteVersion}`}
					>
						<Timestamp value={latestBenchmark.issuedAt} />
					</KeyValueRow>
					{#if latestBenchmark.completedAt}
						<KeyValueRow label="Completed">
							<Timestamp value={latestBenchmark.completedAt} />
						</KeyValueRow>
					{/if}
				{:else}
					<KeyValueRow label="State" value={null} />
				{/if}
				{#if verification.benchmarkExpiresAt}
					<KeyValueRow
						label={benchmarkExpired(verification.benchmarkExpiresAt)
							? 'Expired'
							: 'Expires'}
					>
						<Timestamp value={verification.benchmarkExpiresAt} />
					</KeyValueRow>
				{/if}
			</KeyValueList>
		</div>
	</SettingsSection>
</div>
