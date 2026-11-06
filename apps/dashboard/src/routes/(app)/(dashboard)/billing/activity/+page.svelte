<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { EscrowEventParty } from '@snapflow/api-client';
import BillingHeader from '#lib/features/billing/components/billing-header.svelte';
import EscrowEventHistory from '#lib/features/billing/components/payments/escrow-event-history.svelte';
import { isCustomerEvent } from '#lib/features/billing/lib/escrow-event.ts';
</script>

<svelte:head>
	<title>Activity · Billing · Snapflow</title>
</svelte:head>

<BillingHeader />
<EscrowEventHistory
	caption="Escrow activity"
	party={EscrowEventParty.Customer}
	select={isCustomerEvent}
	emptyTitle="No escrow activity yet"
	emptyDescription="Deposits, withdrawals, claims and authorizations appear here once they are confirmed on chain."
/>
