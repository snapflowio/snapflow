<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { AbuseCase } from '@snapflow/api-client';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import PanelSection from '#lib/components/detail/panel-section.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import {
	abuseCaseOpenedBy,
	findingsSummary,
} from '#lib/features/admin/lib/abuse-cases-list.ts';
import { appliedCaseActions } from '#lib/features/admin/lib/abuse-reports-list.ts';
import { formatDateTime } from '#lib/utils/format.ts';

type AbuseCaseDetailsLayout = 'panel' | 'page';

interface AbuseCaseDetailsProps {
	abuseCase: AbuseCase;
	layout?: AbuseCaseDetailsLayout;
}

let { abuseCase, layout = 'panel' }: AbuseCaseDetailsProps = $props();

const Section = $derived(layout === 'page' ? DetailSection : PanelSection);
const framed = $derived(layout === 'page');
const rowAlign = $derived(layout === 'page' ? 'end' : 'start');

const applied = $derived(appliedCaseActions(abuseCase));
</script>

<div class={layout === 'page' ? 'contents' : 'flex flex-col'}>
	<Section title="Case">
		<KeyValueList {framed}>
			<KeyValueRow align={rowAlign} label="Status">
				<ResourceStateBadge state={abuseCase.status} />
			</KeyValueRow>
			<KeyValueRow
				align={rowAlign}
				label="Signals"
				value={findingsSummary(abuseCase)}
			/>
			<KeyValueRow
				align={rowAlign}
				label="Opened by"
				value={abuseCaseOpenedBy(abuseCase)}
			/>
			<KeyValueRow
				align={rowAlign}
				label="First seen"
				value={formatDateTime(abuseCase.firstSeenAt)}
			/>
			<KeyValueRow
				align={rowAlign}
				label="Last seen"
				value={formatDateTime(abuseCase.lastSeenAt)}
			/>
			{#if abuseCase.resolvedAt}
				<KeyValueRow
					align={rowAlign}
					label="Resolved"
					value={formatDateTime(abuseCase.resolvedAt)}
				/>
				<KeyValueRow
					align={rowAlign}
					label="Resolved by"
					value={abuseCase.resolvedBy}
					mono
					copy={abuseCase.resolvedBy}
				/>
			{/if}
		</KeyValueList>
	</Section>
	<Section title="Resources">
		<KeyValueList {framed}>
			<KeyValueRow
				align={rowAlign}
				label="Sandbox"
				value={abuseCase.sandboxId}
				mono
				copy={abuseCase.sandboxId}
			/>
			<KeyValueRow
				align={rowAlign}
				label="Organization"
				value={abuseCase.organizationId}
				mono
				copy={abuseCase.organizationId}
			/>
			<KeyValueRow
				align={rowAlign}
				label="Machine"
				value={abuseCase.machineId}
				mono
				copy={abuseCase.machineId}
			/>
		</KeyValueList>
	</Section>
	<Section title="Actions">
		{#if applied.length === 0}
			<FeedbackState variant="inline" message="No actions applied" />
		{:else}
			<KeyValueList {framed}>
				{#each applied as action (action.label)}
					<KeyValueRow
						align={rowAlign}
						label={action.label}
						value={action.appliedAt}
					/>
				{/each}
			</KeyValueList>
		{/if}
	</Section>
</div>
