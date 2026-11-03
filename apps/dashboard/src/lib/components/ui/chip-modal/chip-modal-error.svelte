<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';

interface ChipModalErrorProps
	extends Omit<HTMLAttributes<HTMLParagraphElement>, 'children'> {
	message?: string | null;
	ref?: HTMLParagraphElement | null;
}

let {
	class: className,
	message,
	ref = $bindable(null),
	...rest
}: ChipModalErrorProps = $props();
</script>

{#if message}
	<p
		bind:this={ref}
		role="alert"
		class={cn('mt-1 px-2 text-(--text-error) text-caption', className)}
		{...rest}
	>
		{message}
	</p>
{/if}
