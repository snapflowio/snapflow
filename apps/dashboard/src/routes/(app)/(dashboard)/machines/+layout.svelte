<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import OrganizationPermissionGate from '#lib/features/organizations/components/organization-permission-gate.svelte';
import type { LayoutProps } from './$types';

let { children }: LayoutProps = $props();
</script>

<OrganizationPermissionGate
	label="machines"
	permission={{ machines: ['read'] }}
>
	{@render children()}
</OrganizationPermissionGate>
