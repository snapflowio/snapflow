<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { SettlementParty } from '@snapflow/api-client';
import BillingHeader from '#lib/features/billing/components/billing-header.svelte';
import PaymentChannelHistory from '#lib/features/billing/components/payments/payment-channel-history.svelte';
</script>

<svelte:head>
	<title>Payments · Billing · Snapflow</title>
</svelte:head>

<BillingHeader />
<PaymentChannelHistory party={SettlementParty.Customer} />
