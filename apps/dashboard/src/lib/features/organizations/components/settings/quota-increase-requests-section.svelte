<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { QuotaIncreaseRequest } from '@snapflow/api-client';
import { relativeTimeLabel } from '#lib/features/organizations/lib/relative-time.ts';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';

const META_SEPARATOR = ' · ';

function requestTitle(request: QuotaIncreaseRequest): string {
	return `${sandboxClassLabel(request.sandboxClass)} limits`;
}

function requestedResources(request: QuotaIncreaseRequest): string {
	const parts = [
		`${request.requestedCpu} vCPU`,
		`${request.requestedMemory} GiB memory`,
		`${request.requestedDisk} GiB disk`,
	];
	if (request.requestedGpu > 0) parts.push(`${request.requestedGpu} GPU`);
	return parts.join(META_SEPARATOR);
}

function requestMeta(request: QuotaIncreaseRequest): string {
	const parts = [
		requestedResources(request),
		`Sent ${relativeTimeLabel(request.createdAt)}`,
	];
	if (request.reviewedAt) {
		parts.push(`reviewed ${relativeTimeLabel(request.reviewedAt)}`);
	}
	if (request.decisionReason) parts.push(request.decisionReason);
	return parts.join(META_SEPARATOR);
}
</script>

<script lang="ts">
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';

interface QuotaIncreaseRequestsSectionProps {
	requests: readonly QuotaIncreaseRequest[];
}

let { requests }: QuotaIncreaseRequestsSectionProps = $props();
</script>

<SettingsSection title={`Requests (${requests.length})`}>
	{#each requests as request (request.id)}
		{#snippet badge()}
			<ResourceStateBadge state={request.status} />
		{/snippet}
		<SettingsResourceRow
			title={requestTitle(request)}
			meta={requestMeta(request)}
			{badge}
		/>
	{/each}
</SettingsSection>
