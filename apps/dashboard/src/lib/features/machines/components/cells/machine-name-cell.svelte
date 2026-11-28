<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
interface MachineNameCellProps {
	name: string;
	sublabel?: string;
}

let { name, sublabel }: MachineNameCellProps = $props();
</script>

<span class="flex min-w-0 items-baseline gap-2">
	<span class="min-w-0 truncate text-(--text-primary)">{name}</span>
	{#if sublabel}
		<span class="shrink-0 font-mono text-(--text-subtle) text-xs">
			{sublabel}
		</span>
	{/if}
</span>
