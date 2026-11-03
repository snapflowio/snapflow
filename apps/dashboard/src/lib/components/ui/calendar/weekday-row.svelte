<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const WEEKDAY_LABEL_LENGTH = 2;
</script>

<script lang="ts">
interface WeekdayRowProps {
	weekdays: readonly string[];
}

let { weekdays }: WeekdayRowProps = $props();
</script>

<div class="grid grid-cols-7">
	{#each weekdays as weekday (weekday)}
		<div
			class="flex h-7 items-center justify-center text-(--text-muted) text-caption"
		>
			{weekday.slice(0, WEEKDAY_LABEL_LENGTH)}
		</div>
	{/each}
</div>
