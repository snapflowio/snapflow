<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PAYLOAD_INDENT = 2;
</script>

<script lang="ts">
import FileArchive from '@lucide/svelte/icons/file-archive';
import type { AbuseEvidence } from '@snapflow/api-client';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	ABUSE_EVIDENCE_KIND_LABEL,
	WITHHELD_DESCRIPTION,
} from '#lib/features/admin/lib/abuse-reports-list.ts';
import { formatDate } from '#lib/utils/format.ts';

interface AbuseReportEvidenceProps {
	evidence: readonly AbuseEvidence[];
}

let { evidence }: AbuseReportEvidenceProps = $props();

const hasRestricted = $derived(evidence.some((item) => item.restricted));
</script>

{#if evidence.length === 0}
	<EmptyState icon={FileArchive} title="No evidence preserved" />
{:else}
	{#if hasRestricted}
		<Notice
			tone="warning"
			title="Do not copy restricted evidence into tickets, chat, logs or AI tools"
		/>
	{/if}
	<DetailSection
		title="Evidence"
		info="Preserved with the case and deleted when its retention ends."
	>
		<ul
			class="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border"
		>
			{#each evidence as item (item.id)}
				<li class="flex flex-col gap-3 px-6 py-4">
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-medium text-(--text-primary) text-sm">
							{ABUSE_EVIDENCE_KIND_LABEL[item.kind]}
						</span>
						{#if item.restricted}
							<Badge variant="error" size="pill">Restricted</Badge>
						{/if}
						<span
							class="ml-auto flex items-center gap-1.5 text-(--text-muted) text-xs"
						>
							<Timestamp value={item.createdAt} />
							<span aria-hidden="true">·</span>
							<span>Kept until {formatDate(item.retainUntil)}</span>
						</span>
					</div>
					{#if item.withheld}
						<p class="text-(--text-muted) text-sm">
							{WITHHELD_DESCRIPTION}
						</p>
					{:else}
						<pre
							class="max-h-75 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-surface-3 p-4 font-mono text-(--text-secondary) text-xs"
						>{JSON.stringify(item.payload, null, PAYLOAD_INDENT)}</pre>
					{/if}
				</li>
			{/each}
		</ul>
	</DetailSection>
{/if}
