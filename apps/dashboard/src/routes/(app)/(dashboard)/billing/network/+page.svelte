<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import PageColumn from '#lib/components/page/page-column.svelte';
import BillingHeader from '#lib/features/billing/components/billing-header.svelte';
import NetworkUsageList from '#lib/features/billing/components/network-usage-list.svelte';
</script>

<svelte:head>
	<title>Network transfer · Billing · Snapflow</title>
</svelte:head>

<BillingHeader />
<PageColumn>
	<NetworkUsageList party="customer" />
</PageColumn>
