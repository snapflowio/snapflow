<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const BILL_TO_DESCRIPTION = 'The name and tax ID printed on your receipts.';
const ADDRESS_DESCRIPTION =
	'Where you are billed. Changes apply to new receipts only.';
const MANAGE_REQUIRED = 'Needs billing: manage';
const TAX_ID_PREFIX = 'Tax ID';
const NOT_SET = 'Not set';
</script>

<script lang="ts">
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import { createQuery } from '@tanstack/svelte-query';
import { billingProfileQueryOptions } from '#lib/api/billing/receipts.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import { billingProfileLines } from '#lib/features/billing/lib/billing-profile.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import BillingDetailsModal from './billing-details-modal.svelte';

const permission = getOrganizationPermission();
const canManage = $derived(permission.can({ billing: ['manage'] }));
const profile = createQuery(() => billingProfileQueryOptions());
const details = $derived(profile.data ?? null);
const billToLines = $derived(
	details
		? [
				details.legalName,
				details.taxId ? `${TAX_ID_PREFIX} ${details.taxId}` : null,
			].filter((line): line is string => line !== null)
		: []
);
const addressLines = $derived(details ? billingProfileLines(details) : []);
let editing = $state(false);
const actions = $derived<HeaderAction[]>([
	{
		id: 'edit-billing-details',
		kind: 'primary',
		label: details ? 'Edit details' : 'Add details',
		icon: details ? Pencil : Plus,
		visible: profile.isSuccess,
		disabled: !canManage,
		disabledReason: canManage ? undefined : MANAGE_REQUIRED,
		onSelect: () => {
			editing = true;
		},
	},
]);
</script>

{#snippet lines(items: readonly string[])}
	{#if items.length > 0}
		<div class="flex min-w-0 flex-col gap-0.5 text-sm">
			{#each items as line, index (index)}
				<p
					class={index === 0
						? 'wrap-break-word text-(--text-primary)'
						: 'wrap-break-word text-(--text-muted)'}
				>
					{line}
				</p>
			{/each}
		</div>
	{:else}
		<span class="text-(--text-muted) text-sm">{NOT_SET}</span>
	{/if}
{/snippet}

<SettingsPage title="Billing details" {actions}>
	{#if profile.isSuccess}
		<SettingsSection>
			<SettingsRow label="Bill to" description={BILL_TO_DESCRIPTION}>
				{@render lines(billToLines)}
			</SettingsRow>
			<SettingsRow label="Address" description={ADDRESS_DESCRIPTION}>
				{@render lines(addressLines)}
			</SettingsRow>
		</SettingsSection>
	{:else if profile.isError}
		<FeedbackState
			tone="error"
			resource="billing details"
			error={profile.error}
			retrying={profile.isFetching}
			onRetry={() => void profile.refetch()}
		/>
	{:else}
		<Skeleton class="h-32 rounded-2xl" />
	{/if}
</SettingsPage>

{#if canManage}
	<BillingDetailsModal bind:open={editing} profile={details} />
{/if}
