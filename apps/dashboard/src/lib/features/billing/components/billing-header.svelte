<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import Credit from '#lib/components/icons/credit.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import { billingTabs } from '#lib/features/billing/lib/billing-tabs.ts';
import { page } from '$app/state';

interface BillingHeaderProps {
	trailing?: Snippet;
}

let { trailing }: BillingHeaderProps = $props();

const tabs = $derived(billingTabs(page.url.pathname));
</script>

<ResourceHeader
	icon={Credit}
	title="Billing"
	{tabs}
	tabsLabel="Billing views"
	{trailing}
/>
