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
import type { ClassValue } from 'svelte/elements';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import type { SandboxAttention } from '#lib/features/sandboxes/lib/sandbox-attention.ts';

interface SandboxAttentionNoticeProps {
	attention: SandboxAttention;
	onUseMachine?: (alternative: SandboxPlacementAlternative) => void;
	class?: ClassValue;
}

let {
	attention,
	onUseMachine,
	class: className,
}: SandboxAttentionNoticeProps = $props();

const alternatives = $derived(attention.alternatives ?? []);
</script>

{#snippet fix()}
	{#if attention.action}
		<Chip variant="secondary" href={attention.action.href}>
			{attention.action.label}
		</Chip>
	{/if}
{/snippet}

<div class={['flex flex-col gap-3', className]}>
	<Notice
		tone={attention.tone}
		title={attention.title}
		info={attention.info}
		action={attention.action ? fix : undefined}
	/>
	{#if alternatives.length > 0}
		<KeyValueList>
			{#each alternatives as alternative (alternative.machineId)}
				<KeyValueRow
					label={locationLabel(alternative.location)}
					align="end"
					action={onUseMachine ? useAction : undefined}
				>
					<Money microUsd={alternative.hourlyPriceMicroUsd} unit="/h" />
				</KeyValueRow>
				{#snippet useAction()}
					<Chip size="compact" onclick={() => onUseMachine?.(alternative)}>
						Use
					</Chip>
				{/snippet}
			{/each}
		</KeyValueList>
	{/if}
</div>
