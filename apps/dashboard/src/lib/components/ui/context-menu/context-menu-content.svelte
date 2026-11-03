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
	type ContextMenuContentProps,
	ContextMenu as ContextMenuPrimitive,
} from 'bits-ui';
import {
	MENU_CONTENT_CLASS,
	MENU_ROOT_MAX_WIDTH_CLASS,
} from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import { cn } from '#lib/utils/utils.ts';

const CONTEXT_MENU_SIDE_OFFSET = 4;

let {
	class: className,
	ref = $bindable(null),
	...rest
}: ContextMenuContentProps = $props();
</script>

<ContextMenuPrimitive.Portal>
	<ContextMenuPrimitive.Content
		bind:ref
		sideOffset={CONTEXT_MENU_SIDE_OFFSET}
		class={cn(
			MENU_CONTENT_CLASS,
			'max-h-[min(420px,var(--bits-context-menu-content-available-height,420px))]',
			MENU_ROOT_MAX_WIDTH_CLASS,
			className
		)}
		{...rest}
		data-native-surface-overlay=""
	/>
</ContextMenuPrimitive.Portal>
