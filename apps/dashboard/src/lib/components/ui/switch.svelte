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
		'peer relative inline-flex h-[18px] w-[37px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-surface-6 transition-colors duration-(--motion-quick) before:absolute before:-inset-3 before:content-[""] focus-visible:focus-ring data-disabled:cursor-not-allowed data-[state=checked]:bg-(--accent-fill) data-disabled:opacity-50',
		className
	)}
	{...props}
>
	<SwitchPrimitives.Thumb
		class="pointer-events-none block size-2 rounded-full ring-0 transition-[translate,background-color] duration-(--motion-quick) ease-out data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-(--text-on-accent) data-[state=unchecked]:translate-x-1 data-[state=unchecked]:bg-(--text-primary)"
	/>
</SwitchPrimitives.Root>
