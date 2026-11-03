<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import CopyCodeButton from '#lib/components/ui/clipboard/copy-code-button.svelte';
import { cn } from '#lib/utils/utils.ts';

interface ResourceInfoRowProps {
	label: string;
	value: string;
	valueClass?: ClassValue;
	copyLabel?: string;
}

let { label, value, valueClass, copyLabel }: ResourceInfoRowProps = $props();
</script>

<div class="flex min-h-7 min-w-0 items-center justify-between gap-3">
	<dt class="shrink-0 text-(--text-tertiary) text-caption">{label}</dt>
	<dd class="flex min-w-0 items-center justify-end gap-0.5">
		<span
			title={value}
			class={cn('min-w-0 truncate text-(--text-body) text-small', valueClass)}
		>
			{value}
		</span>
		{#if copyLabel}
			<CopyCodeButton code={value} label={copyLabel} class="-mr-1.5" />
		{/if}
	</dd>
</div>
