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
import {
	PAGE_COLUMN_CLASS,
	PAGE_SCROLL_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';

interface PageColumnProps {
	children: Snippet;
	class?: ClassValue;
	wide?: boolean;
}

let { children, class: className, wide = false }: PageColumnProps = $props();
</script>

<div class={cn(PAGE_SCROLL_CLASS, 'pt-6')}>
	<div class={cn(PAGE_COLUMN_CLASS, wide && 'max-w-none', className)}>
		{@render children()}
	</div>
</div>
