<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Switch as SwitchPrimitives } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	checked = $bindable(false),
	ref = $bindable(null),
	...props
}: Omit<SwitchPrimitives.RootProps, 'children' | 'child'> = $props();
</script>

<SwitchPrimitives.Root
	bind:ref
	bind:checked
	class={cn(
		'peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-border transition-colors before:absolute before:-inset-3 before:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text-muted)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg data-disabled:cursor-not-allowed data-[state=checked]:bg-(--text-primary) data-disabled:opacity-50',
		className
	)}
	{...props}
>
	<SwitchPrimitives.Thumb
		class="pointer-events-none block size-4 rounded-full bg-surface-2 shadow-xs ring-0 transition-transform data-[state=checked]:translate-x-4.5 data-[state=unchecked]:translate-x-0.5"
	/>
</SwitchPrimitives.Root>
