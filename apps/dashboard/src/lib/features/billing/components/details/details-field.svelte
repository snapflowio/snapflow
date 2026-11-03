<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
interface DetailsFieldProps {
	label: string;
	value: string;
}

let { label, value }: DetailsFieldProps = $props();
</script>

<div class="flex min-w-0 flex-col gap-0.5">
	<span class="text-(--text-tertiary) text-caption">{label}</span>
	<span class="truncate text-(--text-secondary) text-sm tabular-nums">
		{value}
	</span>
</div>
