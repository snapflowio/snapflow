<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipInputProps } from './chip-input.svelte';

interface ChipCopyInputProps
	extends Omit<ChipInputProps, 'value' | 'readonly' | 'endAdornment' | 'type'> {
	value: string;
	concealable?: boolean;
	copyLabel?: string;
}
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Duplicate from '@lucide/svelte/icons/copy';
import Eye from '@lucide/svelte/icons/eye';
import EyeOff from '@lucide/svelte/icons/eye-off';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import ChipInput from './chip-input.svelte';

let {
	value,
	concealable = false,
	copyLabel = 'Copy',
	class: className,
	ref = $bindable(null),
	...props
}: ChipCopyInputProps = $props();

const clipboard = new CopyToClipboard();
let revealedValue = $state<string | null>(null);
const revealed = $derived(revealedValue === value);
const revealLabel = $derived(revealed ? 'Hide value' : 'Show value');

function toggleRevealed() {
	revealedValue = revealed ? null : value;
}
</script>

{#snippet endAdornment()}
	{#if concealable}
		<Tooltip content={revealLabel}>
			{#snippet child({
				props: triggerProps,
			})}
				<IconButton
					{...triggerProps}
					label={revealLabel}
					icon={revealed ? EyeOff : Eye}
					aria-pressed={revealed}
					onclick={toggleRevealed}
				/>
			{/snippet}
		</Tooltip>
	{/if}
	<Tooltip content={clipboard.copied ? 'Copied!' : copyLabel}>
		{#snippet child({
			props: triggerProps,
		})}
			<IconButton
				{...triggerProps}
				label={copyLabel}
				icon={clipboard.copied ? Check : Duplicate}
				onclick={() => clipboard.copy(value)}
			/>
		{/snippet}
	</Tooltip>
{/snippet}

<ChipInput
	bind:ref
	readonly
	{value}
	type={concealable && !revealed ? 'password' : 'text'}
	{endAdornment}
	{...props}
	class={className}
/>
