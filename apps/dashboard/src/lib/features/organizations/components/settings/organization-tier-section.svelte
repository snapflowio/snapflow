<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { OrganizationQuotaTier } from '@snapflow/api-client';
import {
	nextTierProgress,
	type TierProgress,
	tierLabel,
} from '#lib/features/organizations/lib/quota-tiers.ts';
import { formatUsd } from '#lib/utils/usd.ts';

const TOP_TIER_META = 'Highest tier. Request higher limits for more.';

function tierMeta(
	progress: TierProgress | null,
	trailingWindowDays: number
): string {
	if (!progress) return TOP_TIER_META;
	const next = tierLabel(progress.tier.tier);
	if (progress.emailMissing) return `Verify the owner's email → ${next}`;
	const window = progress.trailing ? ` in ${trailingWindowDays} days` : '';
	return `${formatUsd(progress.depositedMicroUsd)} of ${formatUsd(progress.requiredMicroUsd)} deposited${window} → ${next}`;
}
</script>

<script lang="ts">
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import { fundingDialogHref } from '#lib/features/billing/lib/funding-dialog-link.ts';
import { FundingDialog } from '#lib/routing/funding-dialog.ts';
import OrganizationTierLadder from './organization-tier-ladder.svelte';
import SettingsGroupCell from './settings-group-cell.svelte';

interface OrganizationTierSectionProps {
	standing: OrganizationQuotaTier;
	canAddFunds: boolean;
}

let { standing, canAddFunds }: OrganizationTierSectionProps = $props();

let ladderOpen = $state(false);
const progress = $derived(nextTierProgress(standing));
</script>

<SettingsSection
	title="Tier"
	info="Tiers rise on their own as you verify your email and deposit USDC. Limits never drop below a tier you earned, except the top tier, which needs fresh deposits."
>
	<SettingsGroupCell class="flex-col items-stretch gap-2">
		<div class="flex min-w-0 items-center justify-between gap-4">
			<span class="truncate text-(--text-muted) text-sm">Current tier</span>
			<div class="flex shrink-0 items-center gap-2">
				<Chip
					variant="secondary"
					size="compact"
					onclick={() => (ladderOpen = true)}
				>
					Compare tiers
				</Chip>
				{#if progress && !progress.emailMissing && canAddFunds}
					<Chip
						variant="secondary"
						size="compact"
						href={fundingDialogHref(FundingDialog.Deposit)}
					>
						Add funds
					</Chip>
				{/if}
			</div>
		</div>
		<span class="heading-s text-(--text-primary)">
			{tierLabel(standing.tier)}
		</span>
		{#if progress && !progress.emailMissing}
			<Meter
				label={`Progress to ${tierLabel(progress.tier.tier)}`}
				value={Number(progress.depositedMicroUsd)}
				maximum={Number(progress.requiredMicroUsd)}
				valueText={tierMeta(progress, standing.trailingWindowDays)}
				tone="default"
				class="mt-2"
			/>
		{/if}
		<span class="text-(--text-muted) text-sm">
			{tierMeta(progress, standing.trailingWindowDays)}
		</span>
	</SettingsGroupCell>
</SettingsSection>

<OrganizationTierLadder bind:open={ladderOpen} {standing} />
