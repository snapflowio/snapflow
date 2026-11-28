<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import DashboardLayout from '#lib/features/dashboard/components/dashboard-layout.svelte';
import {
	OrganizationPermission,
	setOrganizationPermission,
} from '#lib/features/organizations/state/organization-permission.svelte.ts';
import type { LayoutProps } from './$types';

let { children }: LayoutProps = $props();

const auth = getAuth();
setOrganizationPermission(new OrganizationPermission());
</script>

{#if auth.user}
	<DashboardLayout>{@render children()}</DashboardLayout>
{/if}
