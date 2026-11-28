<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const CUSTOM_TIER_LABEL = 'Custom';
const CUSTOM_TIER_DESCRIPTION =
	'Limits above the highest tier, set by Snapflow after you request them.';
const REQUIREMENT_SEPARATOR = ' · ';
</script>

<script lang="ts">
import type { OrganizationQuotaTier } from '@snapflow/api-client';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import {
	tierLabel,
	tierLimitCells,
	tierRequirements,
} from '#lib/features/organizations/lib/quota-tiers.ts';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { cn } from '#lib/utils/utils.ts';

interface OrganizationTierLadderProps {
	open?: boolean;
	standing: OrganizationQuotaTier;
}

let { open = $bindable(false), standing }: OrganizationTierLadderProps =
	$props();
</script>

<ChipModal bind:open size="lg" srTitle="Compare tiers">
	<ChipModalHeader onClose={() => (open = false)}
		>Compare tiers</ChipModalHeader
	>
	<ChipModalBody>
		<ol class="flex flex-col divide-y divide-border">
			{#each standing.tiers as tier (tier.tier)}
				{const current = $derived(tier.tier === standing.tier)}
				{const requirements = $derived(
					tierRequirements(tier, standing.trailingWindowDays)
				)}
				<li
					class="flex flex-col gap-4 py-5 first:pt-0 last:pb-0"
					aria-current={current ? 'step' : undefined}
				>
					<div class="flex flex-col gap-1">
						<div class="flex flex-wrap items-center gap-2">
							<span
								class={cn(
									'font-medium text-sm',
									current ? 'text-(--text-primary)' : 'text-(--text-body)'
								)}
							>
								{tierLabel(tier.tier)}
							</span>
							{#if current}
								<StatusLabel label="Current" shape="check" tone="success" />
							{:else if tier.tier < standing.tier}
								<StatusLabel label="Unlocked" shape="check" />
							{/if}
						</div>
						{#if requirements.length > 0}
							<p class="text-pretty text-(--text-muted) text-sm">
								{requirements.join(REQUIREMENT_SEPARATOR)}
							</p>
						{/if}
					</div>
					{#each tier.classLimits as limits (limits.sandboxClass)}
						<div class="flex flex-col gap-2">
							<span class="text-(--text-muted) text-xs">
								{sandboxClassLabel(limits.sandboxClass)}
							</span>
							<dl class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
								{#each tierLimitCells(limits) as cell (cell.label)}
									<div class="flex min-w-0 flex-col gap-0.5">
										<dt class="text-(--text-muted) text-xs">{cell.label}</dt>
										<dd class="text-(--text-primary) text-sm tabular-nums">
											{cell.total}
										</dd>
										{#if cell.perSandbox}
											<dd class="text-(--text-subtle) text-xs tabular-nums">
												{cell.perSandbox}
											</dd>
										{/if}
									</div>
								{/each}
							</dl>
						</div>
					{/each}
				</li>
			{/each}
			<li class="flex flex-col gap-1 py-5 first:pt-0 last:pb-0">
				<span class="font-medium text-(--text-body) text-sm"
					>{CUSTOM_TIER_LABEL}</span
				>
				<p class="text-pretty text-(--text-muted) text-sm">
					{CUSTOM_TIER_DESCRIPTION}
				</p>
			</li>
		</ol>
	</ChipModalBody>
	<ChipModalFooter defaultAction="none" cancelLabel="Close" />
</ChipModal>
