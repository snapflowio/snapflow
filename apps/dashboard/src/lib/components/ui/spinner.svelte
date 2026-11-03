<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const SPINNER_SIZES = {
	sm: 'size-4',
	md: 'size-5',
} as const;
</script>

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import Loader from '#lib/components/icons/loader.svelte';
import { cn } from '#lib/utils/utils.ts';

interface SpinnerProps {
	size?: keyof typeof SPINNER_SIZES;
	label?: string;
	class?: ClassValue;
}

let {
	size = 'sm',
	label = 'Loading',
	class: className,
}: SpinnerProps = $props();
</script>

<span role="status" aria-label={label} class="inline-flex">
	<Loader
		animate
		class={cn(SPINNER_SIZES[size], 'text-(--text-icon)', className)}
	/>
</span>
