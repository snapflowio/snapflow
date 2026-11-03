<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Cpu from '@lucide/svelte/icons/cpu';
import type { Snippet } from 'svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import ResourceHeader, {
	type ResourceCreateAction,
} from '#lib/components/resource/resource-header.svelte';
import { listingTabs } from '#lib/features/listings/lib/listing-tabs.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { page } from '$app/state';

interface ListingHeaderProps {
	create?: ResourceCreateAction;
	trailing?: Snippet;
}

let { create, trailing }: ListingHeaderProps = $props();

const permission = getOrganizationPermission();
const viewActions = $derived<HeaderAction[]>(
	listingTabs(page.url.pathname, permission.can({ listings: ['read'] })).map(
		(tab) => ({
			id: `view-${tab.href}`,
			label: tab.label,
			href: tab.href,
			active: tab.active,
		})
	)
);
</script>

<ResourceHeader
	icon={Cpu}
	title="Listings"
	actions={viewActions}
	{create}
	{trailing}
/>
