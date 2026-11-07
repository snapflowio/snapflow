<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { EscrowEventKind, SettlementParty } from '@snapflow/api-client';
import EarningsHeader from '#lib/features/billing/components/earnings-header.svelte';
import EscrowEventHistory from '#lib/features/billing/components/payments/escrow-event-history.svelte';
</script>

<svelte:head>
	<title>Claims · Earnings · Snapflow</title>
</svelte:head>

<EarningsHeader />
<EscrowEventHistory
	caption="Claims"
	party={SettlementParty.Host}
	kinds={[EscrowEventKind.Claimed]}
	emptyTitle="No claims yet"
	emptyDescription="Snapflow claims the vouchers your machines earn from the escrow and pays them to your payout wallet."
/>
