<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';

export type SettingsGroupCellTone = 'default' | 'muted';

interface SettingsGroupCellProps {
	tone?: SettingsGroupCellTone;
	class?: ClassValue;
	children: Snippet;
}

const TONE_CLASS: Record<SettingsGroupCellTone, string> = {
	default: 'flex items-center gap-2',
	muted: 'text-(--text-muted) text-sm',
};
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

let {
	tone = 'default',
	class: className,
	children,
}: SettingsGroupCellProps = $props();
</script>

<div data-settings-row="" class={cn(TONE_CLASS[tone], className)}>
	{@render children()}
</div>
