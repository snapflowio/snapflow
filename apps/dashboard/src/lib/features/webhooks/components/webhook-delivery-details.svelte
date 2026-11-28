<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { WebhookDelivery } from '@snapflow/api-client';

const JSON_INDENT = 2;

interface WebhookDeliveryDetailsProps {
	delivery: WebhookDelivery;
}
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { webhookDeliveryAttemptsQueryOptions } from '#lib/api/webhooks.ts';
import PanelSection, {
	PANEL_CODE_CLASS,
} from '#lib/components/detail/panel-section.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import CopyCodeButton from '#lib/components/ui/clipboard/copy-code-button.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	attemptSummary,
	deliveryStatusDisplay,
	responseCodeLabel,
} from '#lib/features/webhooks/lib/webhook-display.ts';

let { delivery }: WebhookDeliveryDetailsProps = $props();

const attemptsQuery = createQuery(() =>
	webhookDeliveryAttemptsQueryOptions({
		endpointId: delivery.endpointId,
		id: delivery.id,
	})
);
const attempts = $derived(attemptsQuery.data ?? []);
const latest = $derived(attempts.at(0) ?? null);
const status = $derived(deliveryStatusDisplay(delivery));
const payload = $derived(JSON.stringify(delivery.payload, null, JSON_INDENT));
</script>

<div class="flex flex-col pt-1">
	<PanelSection title="Response">
		<KeyValueList framed={false}>
			<KeyValueRow label="Status">
				<StatusLabel
					label={status.label}
					shape={status.shape}
					tone={status.tone}
					live={status.live}
				/>
			</KeyValueRow>
			<KeyValueRow
				label="HTTP code"
				value={responseCodeLabel(delivery.lastResponseStatus)}
				mono
			/>
			<KeyValueRow label="Attempts" value={delivery.attempts} />
			{#if delivery.nextAttemptAt}
				<KeyValueRow label="Next attempt">
					<Timestamp value={delivery.nextAttemptAt} />
				</KeyValueRow>
			{/if}
		</KeyValueList>
		{#if latest?.error}
			<p class="wrap-break-word text-(--text-error) text-xs">
				{latest.error}
			</p>
		{/if}
		{#if latest?.responseBody}
			<pre
				class={[PANEL_CODE_CLASS, 'max-h-40 whitespace-pre-wrap break-all']}
			>{latest.responseBody}</pre>
		{/if}
	</PanelSection>

	<PanelSection title="Payload">
		{#snippet action()}
			<CopyCodeButton code={payload} label="Copy payload" />
		{/snippet}
		<pre class={[PANEL_CODE_CLASS, 'max-h-72']}>{payload}</pre>
	</PanelSection>

	<PanelSection title="Attempts">
		{#if attemptsQuery.isPending}
			<Skeleton class="h-7" repeat={SKELETON_SECTION_ROWS} fade />
		{:else if attemptsQuery.isError}
			<FeedbackState
				variant="inline"
				tone="error"
				resource="attempts"
				error={attemptsQuery.error}
				retrying={attemptsQuery.isFetching}
				onRetry={() => void attemptsQuery.refetch()}
			/>
		{:else if attempts.length === 0}
			<p class="text-(--text-muted) text-sm">Not attempted yet</p>
		{:else}
			<ol class="flex flex-col">
				{#each attempts as attempt, index (attempt.id)}
					<li class="flex min-h-9 items-center gap-3 text-xs">
						<StatusRing
							shape={attempt.succeeded ? 'check' : 'cross'}
							tone={attempt.succeeded ? 'success' : 'error'}
						/>
						<span class="shrink-0 font-mono text-(--text-muted)">
							#{attempts.length - index}
						</span>
						<span class="min-w-0 truncate font-mono text-(--text-secondary)">
							{attemptSummary(attempt)}
						</span>
						<Timestamp value={attempt.createdAt} class="ml-auto shrink-0" />
					</li>
				{/each}
			</ol>
		{/if}
	</PanelSection>
</div>
