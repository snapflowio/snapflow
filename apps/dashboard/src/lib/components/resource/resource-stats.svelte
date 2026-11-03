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
import { cn } from '#lib/utils/utils.ts';

interface ResourceStatsProps {
	children: Snippet;
	class?: ClassValue;
	label?: string;
	bleed?: boolean;
}

let {
	children,
	class: className,
	label,
	bleed = false,
}: ResourceStatsProps = $props();
</script>

<dl
	aria-label={label}
	class={cn(
		'grid shrink-0 grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-px overflow-hidden bg-border',
		bleed ? 'border-border border-b' : 'rounded-lg border border-border',
		className
	)}
>
	{@render children()}
</dl>
