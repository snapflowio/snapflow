<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const UNAVAILABLE_TIMESTAMP = 'Not available';
</script>

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceStat from '#lib/components/resource/resource-stat.svelte';
import ResourceStats from '#lib/components/resource/resource-stats.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import MachineDetailRow from '#lib/features/machines/components/detail/machine-detail-row.svelte';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import {
	formatBasisPointsPercent,
	formatOptionalDateTime,
} from '#lib/utils/format.ts';

const machineDetail = getMachineDetail();
const trust = $derived(machineDetail.trust.data);
</script>

{#snippet reasons()}
	{trust?.qualificationReasons.join(', ')}
{/snippet}

<PageColumn>
	{#if machineDetail.trust.isLoading}
		<FeedbackState message="Loading..." />
	{:else if !trust}
		<Notice>
			{#snippet title()}
				Awaiting assessment
			{/snippet}
			{#snippet description()}
				The machine is assessed after its first benchmark and qualification
				check.
			{/snippet}
		</Notice>
	{:else}
		{#if trust.restrictionReason}
			{const restriction = $derived(trust.restrictionReason)}
			<Notice tone="warning">
				{#snippet title()}
					Placement is restricted
				{/snippet}
				{#snippet description()}
					{`${restriction}. Restricted until ${formatOptionalDateTime(trust.restrictedUntil, UNAVAILABLE_TIMESTAMP)}.`}
				{/snippet}
			</Notice>
		{/if}
		<SettingsSection title="Qualification">
			<KeyValueList>
				<KeyValueRow
					detail={trust.qualificationReasons.length > 0 ? reasons : undefined}
				>
					{#snippet label()}
						Status
					{/snippet}
					{#snippet value()}
						<Badge size="sm" dot variant={trust.qualified ? 'green' : 'amber'}>
							{trust.qualified ? 'Qualified' : 'Not qualified'}
						</Badge>
					{/snippet}
				</KeyValueRow>
				<MachineDetailRow label="Stage" value={trust.trustStage} />
				<MachineDetailRow
					label="Expires"
					value={formatOptionalDateTime(
						trust.qualificationExpiresAt,
						UNAVAILABLE_TIMESTAMP
					)}
				/>
				<MachineDetailRow
					label="Probation ends"
					value={formatOptionalDateTime(trust.probationEndsAt, 'None')}
				/>
			</KeyValueList>
		</SettingsSection>
		<SettingsSection title="Scores">
			<ResourceStats class="lg:grid-cols-4">
				<ResourceStat
					label="Reliability"
					value={formatBasisPointsPercent(trust.reliabilityBasisPoints)}
				/>
				<ResourceStat
					label="Uptime"
					value={formatBasisPointsPercent(trust.uptimeBasisPoints)}
				/>
				<ResourceStat
					label="Health"
					value={formatBasisPointsPercent(trust.healthBasisPoints)}
				/>
				<ResourceStat
					label="Attestation"
					value={formatBasisPointsPercent(trust.attestationBasisPoints)}
				/>
			</ResourceStats>
		</SettingsSection>
		<SettingsSection title="Evidence">
			<KeyValueList>
				<MachineDetailRow
					label="Successful samples"
					value={trust.successfulSamples}
				/>
				<MachineDetailRow
					label="Machine failures"
					value={trust.machineAttributableFailures}
				/>
				<MachineDetailRow
					label="Unattributed failures"
					value={trust.unattributedFailureCount}
				/>
				<MachineDetailRow
					label="Platform-observed events"
					value={trust.platformObservedEventCount}
				/>
				<MachineDetailRow
					label="Quarantined billing lines"
					value={trust.quarantinedLineCount}
				/>
				<MachineDetailRow
					label="Excluded workloads"
					value={trust.excludedWorkloadCount}
				/>
				<MachineDetailRow label="Relapses" value={trust.relapseCount} />
			</KeyValueList>
		</SettingsSection>
	{/if}
</PageColumn>
