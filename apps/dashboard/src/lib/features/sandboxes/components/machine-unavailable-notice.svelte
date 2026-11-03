<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { SandboxPlacementAlternative } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

interface MachineUnavailableNoticeProps {
	alternatives: readonly SandboxPlacementAlternative[];
	onUseMachine?: (alternative: SandboxPlacementAlternative) => void;
	reason: string;
}

let { alternatives, onUseMachine, reason }: MachineUnavailableNoticeProps =
	$props();
</script>

<div class="flex flex-col gap-2">
	<Notice tone="warning">
		{#snippet title()}
			The machine is unavailable: {reason}
		{/snippet}
		{#snippet description()}
			{alternatives.length > 0
				? 'These matching machines can take the sandbox now.'
				: 'No matching machine can take the sandbox right now.'}
		{/snippet}
	</Notice>
	{#if alternatives.length > 0}
		<KeyValueList>
			{#each alternatives as alternative (alternative.machineId)}
				<KeyValueRow action={onUseMachine ? useAction : undefined}>
					{#snippet label()}
						{locationLabel(alternative.location)}
					{/snippet}
					{#snippet value()}
						{formatHourlyPrice(alternative.hourlyPriceMicroUsd)}
					{/snippet}
					{#snippet detail()}
						{`${formatBasisPointsPercent(alternative.reliabilityBasisPoints)} reliability · ${alternative.machineId}`}
					{/snippet}
				</KeyValueRow>
				{#snippet useAction()}
					<Chip onclick={() => onUseMachine?.(alternative)}>Use</Chip>
				{/snippet}
			{/each}
		</KeyValueList>
	{/if}
</div>
