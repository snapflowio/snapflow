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
import Checkbox from './checkbox.svelte';

interface LabeledCheckboxProps {
	checked?: boolean;
	children: Snippet;
	description?: string;
	disabled?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}

let {
	checked = $bindable(false),
	children,
	description,
	disabled,
	onCheckedChange,
}: LabeledCheckboxProps = $props();

const id = $props.id();
</script>

<div class="flex items-start gap-2.5">
	<Checkbox
		{id}
		class="mt-0.5"
		{checked}
		{disabled}
		aria-describedby={description ? `${id}-description` : undefined}
		onCheckedChange={(next) => {
			checked = next;
			onCheckedChange?.(next);
		}}
	/>
	<div class="flex min-w-0 flex-col gap-0.5">
		<!-- biome-ignore lint/a11y/noLabelWithoutControl: the label text comes from the children snippet, which Biome cannot see; the control is linked through for={id} -->
		<label for={id} class="text-(--text-body) text-small">
			{@render children()}
		</label>
		{#if description}
			<p id={`${id}-description`} class="text-(--text-muted) text-caption">
				{description}
			</p>
		{/if}
	</div>
</div>
