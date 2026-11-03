<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MAXIMUM_PERCENT = 100;
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

interface UsageMeterProps {
	percent: number;
}

let { percent }: UsageMeterProps = $props();

const width = $derived(Math.min(MAXIMUM_PERCENT, Math.max(0, percent)));
</script>

<div
	aria-hidden="true"
	class="h-1 w-30 shrink-0 overflow-hidden rounded-full bg-border"
>
	<div
		class={cn(
			'h-full rounded-full',
			percent >= MAXIMUM_PERCENT ? 'bg-(--text-error)' : 'bg-brand-secondary'
		)}
		style:width={`${width}%`}
	></div>
</div>
