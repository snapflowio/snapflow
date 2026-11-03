<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Label from '#lib/components/ui/label.svelte';
import Switch from '#lib/components/ui/switch.svelte';

interface SettingsToggleRowProps {
	label: string;
	caption?: string;
	checked?: boolean;
	disabled?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}

let {
	label,
	caption,
	checked = $bindable(false),
	disabled = false,
	onCheckedChange,
}: SettingsToggleRowProps = $props();

const id = $props.id();
</script>

<div class="flex items-center justify-between gap-4">
	<div class="flex min-w-0 flex-col gap-1">
		<Label for={id}>{label}</Label>
		{#if caption}
			<p id={`${id}-caption`} class="text-(--text-muted) text-caption">
				{caption}
			</p>
		{/if}
	</div>
	<Switch
		{id}
		bind:checked
		{disabled}
		aria-describedby={caption ? `${id}-caption` : undefined}
		{onCheckedChange}
	/>
</div>
