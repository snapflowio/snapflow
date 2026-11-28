<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';

export type IdentityTileSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IdentityTileProps {
	name: string;
	size?: IdentityTileSize;
	dashed?: boolean;
	class?: ClassValue;
}

const SIZE_CLASS: Record<IdentityTileSize, string> = {
	xs: 'size-4 text-[8px]',
	sm: 'size-6 text-[10px]',
	md: 'size-8 text-xs',
	lg: 'size-10 text-sm',
	xl: 'size-12 text-base',
};
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

let {
	name,
	size = 'xs',
	dashed = false,
	class: className,
}: IdentityTileProps = $props();

const initial = $derived(name.trim().charAt(0).toUpperCase());
</script>

<span
	aria-hidden="true"
	class={cn(
		'relative inline-flex shrink-0 items-center justify-center rounded-full font-sans uppercase leading-none',
		SIZE_CLASS[size],
		dashed
			? 'border border-(--text-subtle) border-dashed text-(--text-subtle)'
			: 'bg-surface-5 text-(--text-subtle) ring-1 ring-white/10 ring-inset',
		className
	)}
>
	{dashed ? '' : initial}
</span>
