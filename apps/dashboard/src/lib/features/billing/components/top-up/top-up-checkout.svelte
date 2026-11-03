<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import SummaryRow from '#lib/features/billing/components/overview/summary-row.svelte';
import { TOP_UP_PAY_NOTICE } from '#lib/features/billing/lib/top-up-limits.ts';
import type { TopUpCheckout } from '#lib/features/billing/state/top-up-checkout.svelte.ts';
import { formatCents } from '#lib/utils/usd.ts';

interface TopUpCheckoutProps {
	checkout: TopUpCheckout;
	amountCents: number | null;
}

let { checkout, amountCents }: TopUpCheckoutProps = $props();
</script>

<SettingsSection title="Payment">
	{#if checkout.session}
		<form class="flex flex-col gap-6" onsubmit={checkout.pay}>
			<div>
				{#if !checkout.ready}
					<p class="py-2 text-(--text-muted) text-small">
						Loading payment form...
					</p>
				{/if}
				<div
					{@attach checkout.paymentElement(checkout.session.clientSecret)}
				></div>
			</div>
			<div class="flex flex-col gap-4 border-border border-t pt-4">
				<SummaryRow
					label="Total due"
					value={checkout.payCents === null
						? EMPTY_CELL_PLACEHOLDER
						: formatCents(checkout.payCents)}
				/>
				{#if checkout.errorMessage}
					<p role="alert" class="text-(--text-error) text-caption">
						{checkout.errorMessage}
					</p>
				{/if}
				<div class="flex items-center justify-between gap-4">
					<p class="text-(--text-muted) text-caption">{TOP_UP_PAY_NOTICE}</p>
					<Chip type="submit" variant="primary" disabled={!checkout.canPay}>
						{checkout.paying
							? 'Processing...'
							: checkout.payCents === null
								? 'Pay'
								: `Pay ${formatCents(checkout.payCents)}`}
					</Chip>
				</div>
			</div>
		</form>
	{:else if checkout.createError}
		<FeedbackState
			class="py-4"
			tone="error"
			message={checkout.createError}
			onRetry={checkout.restart}
		/>
	{:else if amountCents === null}
		<FeedbackState class="py-4" message="Enter a valid amount." />
	{:else}
		<FeedbackState class="py-4" message="Preparing checkout..." />
	{/if}
</SettingsSection>
