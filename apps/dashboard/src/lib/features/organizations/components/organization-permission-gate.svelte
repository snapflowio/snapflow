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
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceNoAccess from '#lib/components/resource/resource-no-access.svelte';
import Skeleton, {
	SKELETON_BLOCK_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import type { OrganizationPermission } from '#lib/features/organizations/lib/organization-permission.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

interface OrganizationPermissionGateProps {
	children: Snippet;
	label: string;
	title: string;
	permission: OrganizationPermission;
}

let { children, label, title, permission }: OrganizationPermissionGateProps =
	$props();

const organizationPermission = getOrganizationPermission();
</script>

{#if organizationPermission.isPending}
	<div class="px-4 pt-8 md:px-8">
		<Skeleton class="h-10" repeat={SKELETON_BLOCK_ROWS} fade />
	</div>
{:else if organizationPermission.can(permission)}
	{@render children()}
{:else}
	<PageColumn {title}>
		<ResourceNoAccess resource={label} />
	</PageColumn>
{/if}
