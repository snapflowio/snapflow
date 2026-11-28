<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { MachineTrustDto } from '@snapflow/api-client';
import { formatDateTime } from '#lib/utils/format.ts';

const NONE_LABEL = 'None';

type ScoreKey =
	| 'reliabilityBasisPoints'
	| 'uptimeBasisPoints'
	| 'healthBasisPoints'
	| 'attestationBasisPoints';

const SCORES: readonly { key: ScoreKey; label: string }[] = [
	{ key: 'reliabilityBasisPoints', label: 'Reliability' },
	{ key: 'uptimeBasisPoints', label: 'Uptime' },
	{ key: 'healthBasisPoints', label: 'Health' },
	{ key: 'attestationBasisPoints', label: 'Attestation' },
];

type EvidenceKey =
	| 'successfulSamples'
	| 'machineAttributableFailures'
	| 'unattributedFailureCount'
	| 'platformObservedEventCount'
	| 'quarantinedLineCount'
	| 'excludedWorkloadCount'
	| 'relapseCount';

const EVIDENCE: readonly { key: EvidenceKey; label: string }[] = [
	{ key: 'successfulSamples', label: 'Successful samples' },
	{ key: 'machineAttributableFailures', label: 'Machine failures' },
	{ key: 'unattributedFailureCount', label: 'Unattributed failures' },
	{ key: 'platformObservedEventCount', label: 'Platform-observed events' },
	{ key: 'quarantinedLineCount', label: 'Quarantined billing lines' },
	{ key: 'excludedWorkloadCount', label: 'Excluded workloads' },
	{ key: 'relapseCount', label: 'Relapses' },
];

function restrictionActive(trust: MachineTrustDto): boolean {
	return (
		!trust.restrictedUntil ||
		new Date(trust.restrictedUntil).getTime() > Date.now()
	);
}

function restrictionTitle(trust: MachineTrustDto): string {
	return trust.restrictedUntil
		? `Placement is restricted until ${formatDateTime(trust.restrictedUntil)}`
		: 'Placement is restricted';
}
</script>

<script lang="ts">
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import DetailColumn from '#lib/components/detail/detail-column.svelte';
import DetailItem from '#lib/components/detail/detail-item.svelte';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import MetricCell from '#lib/components/detail/metric-cell.svelte';
import MetricGroup, {
	metricColumns,
} from '#lib/components/detail/metric-group.svelte';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import { formatBasisPointsPercent, formatCount } from '#lib/utils/format.ts';
import { sentenceCase } from '#lib/utils/text.ts';
import DetailDisclosure from './detail-disclosure.svelte';

const detail = getMachineDetail();
const trust = $derived(detail.trust.data);
</script>

{#snippet qualificationBadge()}
	{#if trust}
		<Badge
			size="sm"
			variant={trust.qualified ? 'success' : 'warning'}
			tooltip={trust.qualificationReasons.join(', ') || undefined}
		>
			{trust.qualified ? 'Qualified' : 'Not qualified'}
		</Badge>
	{/if}
{/snippet}

<PageColumn class="gap-y-12">
	{#if detail.trust.isLoading}
		<Skeleton class="h-7" repeat={SKELETON_SECTION_ROWS} fade />
	{:else if !trust}
		<StatusBlock
			icon={ShieldCheck}
			title="Awaiting assessment"
			description="The machine is assessed after its first benchmark and qualification check."
		/>
	{:else}
		{#if trust.restrictionReason && restrictionActive(trust)}
			<Notice
				tone="warning"
				title={restrictionTitle(trust)}
				info={sentenceCase(trust.restrictionReason)}
			/>
		{/if}
		<DetailSection title="Scores">
			<MetricGroup label="Scores" columns={metricColumns(SCORES.length)}>
				{#each SCORES as score (score.key)}
					<MetricCell
						size="md"
						title={score.label}
						value={formatBasisPointsPercent(trust[score.key])}
					/>
				{/each}
			</MetricGroup>
		</DetailSection>
		<DetailSection title="Qualification" action={qualificationBadge} separated>
			<DetailColumn>
				<DetailItem label="Stage" value={sentenceCase(trust.trustStage)} />
				<DetailItem label="Expires">
					{#if trust.qualificationExpiresAt}
						<Timestamp value={trust.qualificationExpiresAt} />
					{:else}
						<span class="text-(--text-subtle)">{NONE_LABEL}</span>
					{/if}
				</DetailItem>
				<DetailItem label="Probation ends">
					{#if trust.probationEndsAt}
						<Timestamp value={trust.probationEndsAt} />
					{:else}
						<span class="text-(--text-subtle)">{NONE_LABEL}</span>
					{/if}
				</DetailItem>
			</DetailColumn>
			<DetailDisclosure showLabel="Show evidence" hideLabel="Hide evidence">
				<DetailColumn>
					{#each EVIDENCE as item (item.key)}
						<DetailItem
							label={item.label}
							value={formatCount(trust[item.key])}
						/>
					{/each}
				</DetailColumn>
			</DetailDisclosure>
		</DetailSection>
	{/if}
</PageColumn>
