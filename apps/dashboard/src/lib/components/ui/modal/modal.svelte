<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';

interface ModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children?: Snippet;
}

let { open = $bindable(false), onOpenChange, children }: ModalProps = $props();
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
	{@render children?.()}
</DialogPrimitive.Root>
