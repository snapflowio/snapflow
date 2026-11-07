<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import HandCoins from '@lucide/svelte/icons/hand-coins';
import type { Snippet } from 'svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import { earningsTabs } from '#lib/features/billing/lib/billing-tabs.ts';
import { page } from '$app/state';

interface EarningsHeaderProps {
	actions?: readonly HeaderAction[];
	status?: Snippet;
}

let { actions, status }: EarningsHeaderProps = $props();

const tabs = $derived(earningsTabs(page.url.pathname));
</script>

<ResourceHeader
	icon={HandCoins}
	title="Earnings"
	{tabs}
	tabsLabel="Earnings views"
	{status}
	{actions}
/>
