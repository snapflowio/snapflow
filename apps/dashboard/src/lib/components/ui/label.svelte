<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Label as LabelPrimitive } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	ref = $bindable(null),
	...props
}: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	class={cn(
		'inline-flex items-center text-(--text-primary) text-small leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
		className
	)}
	{...props}
/>
