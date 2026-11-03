<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Avatar as AvatarPrimitive } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	ref = $bindable(null),
	...props
}: AvatarPrimitive.FallbackProps = $props();
</script>

<AvatarPrimitive.Fallback
	bind:ref
	class={cn(
		'flex h-full w-full items-center justify-center rounded-full border border-border bg-surface-4 font-medium text-(--text-secondary) text-xs',
		className
	)}
	{...props}
/>
