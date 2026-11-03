<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { BillingConfig } from '@snapflow/api-client';
import { TopUpAmount } from '#lib/features/billing/state/top-up-amount.svelte.ts';
import { TopUpCheckout } from '#lib/features/billing/state/top-up-checkout.svelte.ts';
import TopUpAmountForm from './top-up-amount-form.svelte';
import TopUpCheckoutSection from './top-up-checkout.svelte';

interface TopUpFlowProps {
	config: BillingConfig;
	onDone: () => void;
}

let { config, onDone }: TopUpFlowProps = $props();

const draft = new TopUpAmount(() => config);
const checkout = new TopUpCheckout(
	() => draft.cents,
	() => onDone()
);
</script>

<TopUpAmountForm {draft} disabled={checkout.paying} />
<TopUpCheckoutSection {checkout} amountCents={draft.cents} />
