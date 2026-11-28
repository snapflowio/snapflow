<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export type StatusDotTone = 'success' | 'warning' | 'error' | 'neutral';

const DOT_CLASS: Record<StatusDotTone, string> = {
	success: 'bg-(--success)',
	warning: 'bg-(--warning)',
	error: 'bg-(--error)',
	neutral: 'bg-(--text-subtle)',
};

const TEXT_CLASS: Record<StatusDotTone, string> = {
	success: 'text-(--success)',
	warning: 'text-(--warning)',
	error: 'text-(--error)',
	neutral: 'text-(--text-muted)',
};
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

interface StatusDotProps {
	label: string;
	tone: StatusDotTone;
}

let { label, tone }: StatusDotProps = $props();
</script>

<span class="inline-flex items-center gap-x-1">
	<span
		aria-hidden="true"
		class={cn('block size-1.5 shrink-0 rounded-full', DOT_CLASS[tone])}
	></span>
	<span class={cn('text-xs', TEXT_CLASS[tone])}>{label}</span>
</span>
