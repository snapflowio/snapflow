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
	type DropdownMenuRootProps,
} from 'bits-ui';
import { hasModalContent } from '#lib/components/ui/modal/modal-content.svelte.ts';
import { setDropdownMenuRoot } from './dropdown-menu-context.ts';

interface DropdownMenuProps extends DropdownMenuRootProps {
	modal?: boolean;
}

let {
	open = $bindable(false),
	onOpenChange,
	modal,
	...rest
}: DropdownMenuProps = $props();

const insideModal = hasModalContent();

setDropdownMenuRoot({
	get modal() {
		return modal ?? !insideModal;
	},
	close() {
		if (!open) return;
		open = false;
		onOpenChange?.(false);
	},
});
</script>

<DropdownMenuPrimitive.Root bind:open {onOpenChange} {...rest} />
