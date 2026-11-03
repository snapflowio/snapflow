<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { cva, type VariantProps } from 'class-variance-authority';

const avatarVariants = cva(
	'relative flex shrink-0 overflow-hidden rounded-full',
	{
		variants: {
			size: {
				xs: 'h-3.5 w-3.5',
				sm: 'h-6 w-6',
				md: 'h-8 w-8',
				lg: 'h-10 w-10',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	}
);
const avatarStatusVariants = cva(
	'absolute bottom-0 right-0 rounded-full border-2 border-(--bg)',
	{
		variants: {
			status: {
				online: 'bg-(--success)',
				offline: 'bg-(--text-muted)',
				busy: 'bg-(--error)',
				away: 'bg-(--caution)',
			},
			size: {
				xs: 'h-1.5 w-1.5 border',
				sm: 'h-2 w-2',
				md: 'h-2.5 w-2.5',
				lg: 'h-3 w-3',
			},
		},
		defaultVariants: {
			status: 'online',
			size: 'md',
		},
	}
);
type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';
</script>

<script lang="ts">
import { Avatar as AvatarPrimitive } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';

interface AvatarProps
	extends Omit<AvatarPrimitive.RootProps, 'child'>,
		VariantProps<typeof avatarVariants> {
	status?: AvatarStatus;
}

let {
	class: className,
	size,
	status,
	children,
	ref = $bindable(null),
	...props
}: AvatarProps = $props();
</script>

<div class="relative inline-flex">
	<AvatarPrimitive.Root
		bind:ref
		class={cn(avatarVariants({ size }), className)}
		{...props}
	>
		{#snippet child({
			props: rootProps,
		})}
			<span {...rootProps}>{@render children?.()}</span>
		{/snippet}
	</AvatarPrimitive.Root>
	{#if status}
		<span
			role="status"
			data-slot="avatar-status"
			class={cn(avatarStatusVariants({ status, size }))}
			aria-label={`Status: ${status}`}
		></span>
	{/if}
</div>
