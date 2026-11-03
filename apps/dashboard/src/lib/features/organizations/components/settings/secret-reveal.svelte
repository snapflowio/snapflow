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
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Duplicate from '@lucide/svelte/icons/copy';
import {
	chipFieldSurfaceClass,
	chipFieldTextClass,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { cn } from '#lib/utils/utils.ts';

interface SecretRevealProps {
	value?: string;
	redacted?: boolean;
}

let { value, redacted = false }: SecretRevealProps = $props();

const clipboard = new CopyToClipboard();
const hidden = $derived(redacted || !value);
</script>

<div
	class={cn(
		'flex h-7.5 w-full items-center gap-1.5 px-2',
		chipFieldSurfaceClass
	)}
>
	<code
		class={cn(
			chipFieldTextClass,
			'flex-1 truncate font-mono',
			hidden && 'text-(--text-muted)'
		)}
	>
		{hidden ? REDACTED_DOTS : value}
	</code>
	{#if !hidden && value}
		<IconButton
			variant="ghost"
			label="Copy to clipboard"
			icon={clipboard.copied ? Check : Duplicate}
			class="shrink-0"
			onclick={() => clipboard.copy(value)}
		/>
	{/if}
</div>
