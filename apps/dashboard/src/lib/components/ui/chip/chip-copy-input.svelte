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
	extends Omit<
		ChipInputProps,
		'value' | 'readonly' | 'endAdornment' | 'type' | 'clearable'
	> {
	value: string;
	concealable?: boolean;
	copyLabel?: string;
}

const COPY_TEXT = 'Copy';
const COPIED_LABEL = 'Copied';
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { cn } from '#lib/utils/utils.ts';
import Chip from './chip.svelte';
import ChipInput from './chip-input.svelte';

let {
	value,
	concealable = false,
	copyLabel = COPY_TEXT,
	class: className,
	ref = $bindable(null),
	...props
}: ChipCopyInputProps = $props();

const clipboard = new CopyToClipboard();
</script>

{#snippet endAdornment()}
	<Chip
		variant="ghost"
		size="compact"
		class="-mr-2 shrink-0 font-sans"
		aria-label={clipboard.copied ? COPIED_LABEL : copyLabel}
		onclick={() => clipboard.copy(value)}
	>
		{#if clipboard.copied}
			<Check class="size-4" />
		{:else}
			{COPY_TEXT}
		{/if}
	</Chip>
{/snippet}

<ChipInput
	bind:ref
	readonly
	{value}
	{concealable}
	{endAdornment}
	{...props}
	class={cn('[&_input]:text-ellipsis [&_input]:text-(--text-muted)', className)}
/>
