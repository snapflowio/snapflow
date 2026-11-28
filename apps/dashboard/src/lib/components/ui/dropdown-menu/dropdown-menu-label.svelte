<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';
import { MENU_HEADING_CLASS } from './dropdown-menu-styles.ts';

interface DropdownMenuLabelProps extends HTMLAttributes<HTMLDivElement> {
	inset?: boolean;
	ref?: HTMLDivElement | null;
}

let {
	class: className,
	inset,
	children,
	ref = $bindable(null),
	...rest
}: DropdownMenuLabelProps = $props();
</script>

<div
	bind:this={ref}
	class={cn(MENU_HEADING_CLASS, inset && 'pl-7', className)}
	{...rest}
>
	{@render children?.()}
</div>
