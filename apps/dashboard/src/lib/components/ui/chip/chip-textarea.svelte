<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HTMLTextareaAttributes } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';
import { chipFieldSurfaceClass, chipFieldTextClass } from './chip-chrome.ts';

interface ChipTextareaProps extends HTMLTextareaAttributes {
	error?: boolean;
	resizable?: boolean;
	ref?: HTMLTextAreaElement | null;
}

let {
	class: className,
	error: invalid = false,
	resizable = false,
	value = $bindable(),
	ref = $bindable(null),
	...rest
}: ChipTextareaProps = $props();
</script>

<textarea
	bind:this={ref}
	bind:value
	class={cn(
		chipFieldSurfaceClass,
		chipFieldTextClass,
		'block min-h-15 w-full overflow-auto px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-50',
		resizable ? 'resize-y' : 'resize-none',
		invalid && 'border-(--text-error)',
		className
	)}
	aria-invalid={invalid || undefined}
	{...rest}
></textarea>
