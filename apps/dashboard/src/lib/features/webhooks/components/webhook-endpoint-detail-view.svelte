<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const NEVER_LABEL = 'Never';
const SECRET_MASK = 'whsec_••••••••';
const SECRET_INFO = 'Shown only once, after creation or rotation.';
const STOPPED_TITLE =
	'Stopped after repeated failures. Fix the endpoint, then enable it.';
</script>

<script lang="ts">
import Send from '@lucide/svelte/icons/send';
import Webhook from '@lucide/svelte/icons/webhook';
import ContextCard from '#lib/components/detail/context-card.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import WebhookDeliveryDetails from '#lib/features/webhooks/components/webhook-delivery-details.svelte';
import WebhookDeliveryList from '#lib/features/webhooks/components/webhook-delivery-list.svelte';
import WebhookEndpointDialogs from '#lib/features/webhooks/components/webhook-endpoint-dialogs.svelte';
import {
	DELIVERY_STATUS_FILTER_OPTIONS,
	endpointAddress,
	endpointStatusDisplay,
	endpointStoppedForFailures,
	eventFilterOptions,
	HTTP_CLASS_FILTER_OPTIONS,
} from '#lib/features/webhooks/lib/webhook-display.ts';
import { webhookEventLabel } from '#lib/features/webhooks/lib/webhook-events.ts';
import { WebhookEndpointDetail } from '#lib/features/webhooks/state/webhook-endpoint-detail.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';

let { endpointId }: { endpointId: string } = $props();

const detail = new WebhookEndpointDetail(() => endpointId);
const panel = detail.panel;
const switchId = $props.id();
const listCrumb = {
	label: 'Webhooks',
	href: resolvePath(Path.SETTINGS_WEBHOOKS),
	icon: Webhook,
};
</script>

{#snippet deliveryFilters()}
	<ChipDropdown
		size="compact"
		options={DELIVERY_STATUS_FILTER_OPTIONS}
		value={detail.statusFilter}
		onChange={detail.changeStatusFilter}
		matchTriggerWidth={false}
		align="end"
		aria-label="Filter deliveries by status"
	/>
	<ChipDropdown
		size="compact"
		options={HTTP_CLASS_FILTER_OPTIONS}
		value={detail.httpFilter}
		onChange={detail.changeHttpFilter}
		matchTriggerWidth={false}
		align="end"
		aria-label="Filter deliveries by HTTP response"
	/>
	<ChipDropdown
		size="compact"
		options={eventFilterOptions(detail.endpoint?.eventTypes ?? [])}
		value={detail.eventFilter}
		onChange={detail.changeEventFilter}
		matchTriggerWidth={false}
		align="end"
		aria-label="Filter deliveries by event"
	/>
{/snippet}

{#if detail.endpoint}
	{const endpoint = $derived(detail.endpoint)}
	{const address = $derived(endpointAddress(endpoint))}
	{const status = $derived(endpointStatusDisplay(endpoint))}
	{#snippet statusBadge()}
		<Badge variant={status.tone}>{status.label}</Badge>
	{/snippet}
	{#snippet context()}
		<div class="flex flex-col gap-2">
			<ContextCard title="Endpoint">
				<KeyValueList framed={false}>
					<KeyValueRow
						label="Endpoint ID"
						value={endpoint.id}
						copy={endpoint.id}
						copyLabel="Copy endpoint ID"
						mono
					/>
					<KeyValueRow
						label="Signing secret"
						info={SECRET_INFO}
						value={SECRET_MASK}
						mono
					/>
					<KeyValueRow label="Last success">
						{#if endpoint.lastSucceededAt}
							<Timestamp value={endpoint.lastSucceededAt} />
						{:else}
							<span class="text-(--text-subtle)">{NEVER_LABEL}</span>
						{/if}
					</KeyValueRow>
					{#if endpoint.failingSince}
						<KeyValueRow label="Failing since">
							<Timestamp value={endpoint.failingSince} />
						</KeyValueRow>
					{/if}
					{#if endpoint.previousSecretExpiresAt}
						<KeyValueRow label="Previous secret until">
							<Timestamp value={endpoint.previousSecretExpiresAt} />
						</KeyValueRow>
					{/if}
				</KeyValueList>
			</ContextCard>
			<ContextCard title={`Events (${endpoint.eventTypes.length})`}>
				<span class="flex flex-wrap gap-1.5">
					{#each endpoint.eventTypes as eventType (eventType)}
						<Badge size="pill">{webhookEventLabel(eventType)}</Badge>
					{/each}
				</span>
			</ContextCard>
		</div>
	{/snippet}
	<ResourceDetailShell
		breadcrumbs={[listCrumb, { label: endpoint.description || address.host }]}
		status={statusBadge}
		actions={detail.headerActions}
		pending={detail.deliveriesQuery.isFetching}
		aside={context}
		asideTitle="Endpoint"
		tabs={[]}
	>
		<div class="relative flex min-h-0 flex-1 flex-col">
			<PageColumn>
				{#if endpointStoppedForFailures(endpoint)}
					<Notice tone="error" title={STOPPED_TITLE} />
				{/if}

				<div
					class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<p
						class="min-w-0 break-all font-mono text-(--text-secondary) text-sm leading-5"
					>
						{endpoint.url}
					</p>
					<div class="flex shrink-0 items-center gap-3">
						<label for={switchId} class="text-(--text-primary) text-sm">
							{endpoint.enabled ? 'Enabled' : 'Disabled'}
						</label>
						<Switch
							id={switchId}
							checked={endpoint.enabled}
							disabled={!detail.actions.canWrite ||
								detail.actions.updateMutation.isPending}
							onCheckedChange={(enabled) =>
								detail.actions.setEnabled(endpoint, enabled)}
						/>
					</div>
				</div>

				<section aria-labelledby="deliveries-title" class="flex flex-col gap-4">
					<div
						class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
					>
						<h2 id="deliveries-title" class="heading-xxs">Deliveries</h2>
						<div class="flex flex-wrap items-center gap-2">
							{@render deliveryFilters()}
						</div>
					</div>
					{#snippet deliveriesEmpty()}
						<EmptyState
							icon={Send}
							bordered={false}
							title={detail.filtered
								? 'No deliveries match these filters'
								: 'No deliveries yet'}
						>
							{#snippet actions()}
								{#if detail.filtered}
									<Chip variant="secondary" onclick={detail.clearFilters}>
										Clear filters
									</Chip>
								{/if}
							{/snippet}
						</EmptyState>
					{/snippet}
					<WebhookDeliveryList
						deliveries={detail.deliveries}
						selectedId={panel.row?.id ?? null}
						onSelect={panel.open}
						isLoading={detail.deliveriesQuery.isPending}
						isFetching={detail.deliveriesQuery.isFetching}
						errorMessage={detail.deliveriesQuery.isError &&
						detail.deliveriesQuery.data === undefined
							? "Couldn't load deliveries"
							: undefined}
						onRetry={detail.refetch}
						empty={deliveriesEmpty}
						hasMore={detail.deliveriesQuery.hasNextPage}
						loadingMore={detail.deliveriesQuery.isFetchingNextPage}
						onLoadMore={detail.loadMore}
					/>
				</section>
			</PageColumn>
			<ResourceDetailsPanel
				open={panel.row !== null}
				title={panel.row ? webhookEventLabel(panel.row.eventType) : 'Delivery'}
				resourceId={panel.row?.messageId}
				resourceIdLabel="Copy webhook-id"
				width="wide"
				onClose={panel.close}
				onPrevious={panel.previous}
				onNext={panel.next}
			>
				{#snippet actions()}
					{#if detail.actions.canWrite && panel.row}
						{const delivery = $derived(panel.row)}
						<Chip
							variant="secondary"
							size="compact"
							leftIcon={Send}
							loading={detail.resendMutation.isPending}
							onclick={() => detail.resend(delivery)}
						>
							Redeliver
						</Chip>
					{/if}
				{/snippet}
				{#if panel.row}
					{#key panel.row.id}
						<WebhookDeliveryDetails delivery={panel.row} />
					{/key}
				{/if}
			</ResourceDetailsPanel>
		</div>
	</ResourceDetailShell>
{:else if detail.endpointsQuery.isPending}
	<ResourceChromeFallback breadcrumbs={[listCrumb]} />
{:else}
	<Resource>
		<ResourceHeader breadcrumbs={[listCrumb]} />
		{#if detail.endpointsQuery.isError}
			<FeedbackState
				class="flex-1"
				tone="error"
				resource="this endpoint"
				error={detail.endpointsQuery.error}
				retrying={detail.endpointsQuery.isFetching}
				onRetry={() => void detail.endpointsQuery.refetch()}
			/>
		{:else}
			<div class="flex flex-1 flex-col p-4 md:p-8">
				<EmptyState icon={Webhook} title="This endpoint doesn't exist">
					{#snippet actions()}
						<Chip variant="secondary" href={listCrumb.href}>
							Back to webhooks
						</Chip>
					{/snippet}
				</EmptyState>
			</div>
		{/if}
	</Resource>
{/if}

<WebhookEndpointDialogs actions={detail.actions} />
