<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import BillingDetailsView from '#lib/features/billing/components/details/billing-details-view.svelte';
import OrganizationPermissionGate from '#lib/features/organizations/components/organization-permission-gate.svelte';
</script>

<svelte:head>
	<title>Billing details · Settings · Snapflow</title>
</svelte:head>

<OrganizationPermissionGate
	label="billing details"
	title="Billing details"
	permission={{ billing: ['read'] }}
>
	<BillingDetailsView />
</OrganizationPermissionGate>
