<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import {
	DropdownMenu as DropdownMenuPrimitive,
	type DropdownMenuSeparatorProps,
} from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';
import { MENU_SEPARATOR_CLASS } from './dropdown-menu-styles.ts';

let {
	class: className,
	ref = $bindable(null),
	...rest
}: DropdownMenuSeparatorProps = $props();
</script>

<DropdownMenuPrimitive.Separator
	bind:ref
	class={cn(MENU_SEPARATOR_CLASS, className)}
	{...rest}
/>
