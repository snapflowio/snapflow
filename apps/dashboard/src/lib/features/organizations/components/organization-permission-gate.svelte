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
import FeedbackState from '#lib/components/feedback-state.svelte';
import Loading from '#lib/components/loading.svelte';
import type { OrganizationPermission } from '#lib/features/organizations/lib/organization-permission.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

interface OrganizationPermissionGateProps {
	children: Snippet;
	label: string;
	permission: OrganizationPermission;
}

let { children, label, permission }: OrganizationPermissionGateProps = $props();

const organizationPermission = getOrganizationPermission();
</script>

{#if organizationPermission.isPending}
	<Loading />
{:else if organizationPermission.can(permission)}
	{@render children()}
{:else}
	<FeedbackState
		class="h-full border-0"
		message={`Your organization roles do not allow viewing ${label}.`}
	/>
{/if}
