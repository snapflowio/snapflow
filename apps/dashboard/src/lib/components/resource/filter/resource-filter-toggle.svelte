<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Switch from '#lib/components/ui/switch.svelte';

interface ResourceFilterToggleProps {
	checked?: boolean;
	label: string;
	onCheckedChange?: (checked: boolean) => void;
}

let {
	checked = $bindable(false),
	label,
	onCheckedChange,
}: ResourceFilterToggleProps = $props();

function changeChecked(next: boolean): void {
	checked = next;
	onCheckedChange?.(next);
}
</script>

<div class="flex items-center justify-between gap-3">
	<span class="text-caption text-(--text-muted)">{label}</span>
	<Switch aria-label={label} {checked} onCheckedChange={changeChecked} />
</div>
