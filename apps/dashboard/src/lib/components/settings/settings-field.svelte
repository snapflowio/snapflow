<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';

interface SettingsFieldProps {
	label: string;
	value?: string;
	children?: Snippet;
}

let { label, value, children }: SettingsFieldProps = $props();
</script>

<div class="flex flex-col gap-2">
	<span class="text-(--text-muted) text-caption">{label}</span>
	<div class="min-w-0 text-(--text-body) text-sm">
		{#if children}
			{@render children()}
		{:else}
			{value || '—'}
		{/if}
	</div>
</div>
