<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MENU_MAX_HEIGHT_CLASS =
	'max-h-[min(420px,var(--bits-dropdown-menu-content-available-height,420px))]';
</script>

<script lang="ts">
import {
	type DropdownMenuContentProps,
	DropdownMenu as DropdownMenuPrimitive,
} from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';
import { getDropdownMenuRoot } from './dropdown-menu-context.ts';
import {
	MENU_CONTENT_CLASS,
	MENU_ROOT_MAX_WIDTH_CLASS,
	MENU_SIDE_OFFSET,
} from './dropdown-menu-styles.ts';

let {
	class: className,
	sideOffset = MENU_SIDE_OFFSET,
	loop = false,
	ref = $bindable(null),
	...rest
}: DropdownMenuContentProps = $props();

const root = getDropdownMenuRoot();
</script>

<DropdownMenuPrimitive.Portal>
	<DropdownMenuPrimitive.Content
		bind:ref
		{sideOffset}
		{loop}
		strategy="fixed"
		preventScroll={root.modal}
		class={cn(
			MENU_CONTENT_CLASS,
			MENU_MAX_HEIGHT_CLASS,
			'origin-(--bits-dropdown-menu-content-transform-origin)',
			MENU_ROOT_MAX_WIDTH_CLASS,
			className
		)}
		{...rest}
		data-native-surface-overlay=""
	/>
</DropdownMenuPrimitive.Portal>
