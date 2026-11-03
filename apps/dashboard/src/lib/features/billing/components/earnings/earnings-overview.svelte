<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import HandCoins from '@lucide/svelte/icons/hand-coins';
import type { HostEarnings } from '@snapflow/api-client';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import BillingHeading from '#lib/features/billing/components/billing-heading.svelte';
import { formatBillingDate } from '#lib/features/billing/lib/format.ts';
import { formatCents, formatUsd } from '#lib/utils/usd.ts';

interface EarningsOverviewProps {
	earnings: HostEarnings;
}

let { earnings }: EarningsOverviewProps = $props();

const inTransfer = $derived(BigInt(earnings.inTransferMicroUsd) > 0n);
const payoutDetail = $derived(
	[
		`Paid out ${formatBillingDate(earnings.nextPayoutDate)} once it reaches ${formatCents(earnings.payoutMinimumCents)}`,
		inTransfer
			? `${formatUsd(earnings.inTransferMicroUsd)} on its way to your bank`
			: null,
	]
		.filter(Boolean)
		.join(' · ')
);
</script>

<BillingHeading
	icon={HandCoins}
	title={formatUsd(earnings.availableMicroUsd)}
	detail={payoutDetail}
/>

{#if earnings.maturing.length > 0}
	{#snippet pendingTotal()}
		<span class="text-(--text-muted) text-small tabular-nums">
			{formatUsd(earnings.pendingMicroUsd)}
		</span>
	{/snippet}
	<SettingsSection title="Pending" action={pendingTotal}>
		<div class="-mx-2 flex flex-col gap-y-0.5">
			{#each earnings.maturing as maturity (maturity.maturesOn)}
				<div class="flex items-center gap-2.5 rounded-lg p-2">
					<span class="min-w-0 flex-1 truncate text-(--text-body) text-sm">
						{`Available ${formatBillingDate(maturity.maturesOn)}`}
					</span>
					<span class="shrink-0 text-(--text-muted) text-caption tabular-nums">
						{formatUsd(maturity.amountMicroUsd)}
					</span>
				</div>
			{/each}
		</div>
	</SettingsSection>
{/if}
