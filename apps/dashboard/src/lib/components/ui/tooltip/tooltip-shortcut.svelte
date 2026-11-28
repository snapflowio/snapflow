<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import Kbd from '#lib/components/ui/kbd.svelte';

interface TooltipShortcutProps {
	keys: string | readonly string[];
	class?: ClassValue;
	children?: Snippet;
}

let { keys, class: className, children }: TooltipShortcutProps = $props();
</script>

<span class={['flex items-center gap-2', className]}>
	{#if children}
		<span>{@render children()}</span>
	{/if}
	<Kbd {keys} variant="bare" />
</span>
