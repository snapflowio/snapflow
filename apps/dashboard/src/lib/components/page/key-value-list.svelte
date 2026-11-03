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

interface KeyValueListProps {
	children: Snippet;
	class?: ClassValue;
}

let { children, class: className }: KeyValueListProps = $props();
</script>

<dl
	class={cn(
		'flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border bg-surface-2',
		className
	)}
>
	{@render children()}
</dl>
