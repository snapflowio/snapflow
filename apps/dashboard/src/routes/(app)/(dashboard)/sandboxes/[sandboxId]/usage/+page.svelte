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
import { sandboxBillingSummaryQueryOptions } from '#lib/api/sandboxes/sandboxes.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import SandboxBillingSection from '#lib/features/sandboxes/components/overview/sandbox-billing-section.svelte';
import SandboxLeaseSection from '#lib/features/sandboxes/components/overview/sandbox-lease-section.svelte';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';

const detail = getSandboxDetail();
const permission = getOrganizationPermission();
const sandbox = $derived(detail.sandbox);
const canReadBilling = $derived(permission.can({ billing: ['read'] }));
const billingQuery = createQuery(() => ({
	...sandboxBillingSummaryQueryOptions(sandbox.id),
	enabled: canReadBilling,
}));
</script>

<svelte:head>
	<title>Usage · {sandbox.name} · Snapflow</title>
</svelte:head>

<PageColumn>
	<SandboxLeaseSection canWrite={detail.canWrite} sandboxId={sandbox.id} />
	{#if canReadBilling}
		<SandboxBillingSection
			billing={billingQuery.data}
			loading={billingQuery.isPending}
			unavailable={billingQuery.isError}
		/>
	{/if}
</PageColumn>
