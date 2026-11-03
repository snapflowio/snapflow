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
import Label from '#lib/components/ui/label.svelte';

interface SettingsPreferenceRowProps {
	label: string;
	caption?: string;
	for?: string;
	children: Snippet;
}

let {
	label,
	caption,
	for: controlId,
	children,
}: SettingsPreferenceRowProps = $props();
</script>

<div
	class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4"
>
	<div class="flex min-w-0 flex-col gap-1">
		<Label for={controlId}>{label}</Label>
		{#if caption}
			<p class="text-(--text-muted) text-caption">{caption}</p>
		{/if}
	</div>
	<div class="w-full shrink-0 md:w-60">{@render children()}</div>
</div>
