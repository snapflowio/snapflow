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
import Duplicate from '@lucide/svelte/icons/copy';
import type { ClassValue } from 'svelte/elements';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { CopyToClipboard } from './copy-to-clipboard.svelte.ts';

interface CopyCodeButtonProps {
	code: string;
	class?: ClassValue;
	label?: string;
}

let {
	code,
	class: className,
	label = 'Copy value',
}: CopyCodeButtonProps = $props();

const clipboard = new CopyToClipboard();
</script>

<Tooltip content={clipboard.copied ? 'Copied!' : label}>
	{#snippet child({
		props,
	})}
		<IconButton
			{...props}
			{label}
			icon={clipboard.copied ? Check : Duplicate}
			class={className}
			onclick={() => clipboard.copy(code)}
		/>
	{/snippet}
</Tooltip>
