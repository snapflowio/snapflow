<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const REDACTED_DOTS = '••••••••••••••••••••••••••••••••';
const ONE_TIME_NOTE = "Copy this now. You won't see it again.";
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Duplicate from '@lucide/svelte/icons/copy';
import { chipFieldTextClass } from '#lib/components/ui/chip/chip-chrome.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { cn } from '#lib/utils/utils.ts';
import { CopyToClipboard } from './copy-to-clipboard.svelte.ts';

interface SecretRevealProps {
	value?: string;
	redacted?: boolean;
	onCopied?: () => void;
}

let { value, redacted = false, onCopied }: SecretRevealProps = $props();

const clipboard = new CopyToClipboard();
const hidden = $derived(redacted || !value);
</script>

<div class="flex flex-col gap-2">
	{#if !hidden}
		<p class="text-(--text-muted) text-sm">{ONE_TIME_NOTE}</p>
	{/if}
	<div
		class="flex h-10 w-full items-center gap-2 overflow-hidden rounded-xl border border-border bg-surface-3 pr-1 pl-3 shadow-(--shadow-subtle)"
	>
		<code
			class={cn(
				chipFieldTextClass,
				'flex-1 truncate font-mono text-sm md:text-sm',
				hidden && 'text-(--text-muted)'
			)}
		>
			{hidden ? REDACTED_DOTS : value}
		</code>
		{#if !hidden && value}
			<IconButton
				size="md"
				label="Copy to clipboard"
				tooltipContent={clipboard.copied ? 'Copied' : 'Copy to clipboard'}
				icon={clipboard.copied ? Check : Duplicate}
				class="shrink-0"
				onclick={async () => {
					if (await clipboard.copy(value)) onCopied?.();
				}}
			/>
		{/if}
	</div>
</div>
