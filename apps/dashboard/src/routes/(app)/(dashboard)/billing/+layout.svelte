<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Resource from '#lib/components/resource/resource.svelte';
import {
	BillingActions,
	setBillingActions,
} from '#lib/features/billing/state/billing-actions.svelte.ts';
import OrganizationPermissionGate from '#lib/features/organizations/components/organization-permission-gate.svelte';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import type { LayoutProps } from './$types';

let { children }: LayoutProps = $props();

const permission = getOrganizationPermission();
setBillingActions(
	new BillingActions(() => permission.can({ billing: ['manage'] }))
);
</script>

<OrganizationPermissionGate label="billing" permission={{ billing: ['read'] }}>
	<Resource> {@render children()} </Resource>
</OrganizationPermissionGate>
