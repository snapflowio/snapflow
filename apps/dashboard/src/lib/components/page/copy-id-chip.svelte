<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import type { ClassValue } from 'svelte/elements';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { middleTruncate } from '#lib/components/ui/overflow/middle-truncate.ts';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

interface CopyIdChipProps {
	value: string;
	label?: string;
	class?: ClassValue;
}

let { value, label = 'Copy ID', class: className }: CopyIdChipProps = $props();

const clipboard = new CopyToClipboard();
const tooltip = $derived(clipboard.label(label));
</script>

<Tooltip content={tooltip}>
	{#snippet child({ props })}
		<Chip
			{...props}
			aria-label={`${label}: ${value}`}
			size="compact"
			rightIcon={clipboard.copied ? Check : Copy}
			class={cn(
				'min-w-0 max-w-56 font-mono text-(--text-muted) text-xs hover-hover:text-(--text-primary)',
				className
			)}
			onclick={() => void clipboard.copy(value)}
		>
			<span
				class="block min-w-0 overflow-hidden whitespace-nowrap"
				{@attach middleTruncate({ text: value })}
			></span>
		</Chip>
	{/snippet}
</Tooltip>
