<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { CHART_Y_SPLITS } from './chart-layout.ts';

const lines = Array.from({ length: CHART_Y_SPLITS + 1 }, (_, index) => index);
</script>

<div
	role="status"
	aria-busy="true"
	class="absolute inset-0 flex flex-col justify-between py-2"
>
	<span class="sr-only">Loading chart</span>
	{#each lines as line (line)}
		<span
			aria-hidden="true"
			class="block h-px w-full border-(--chart-axis) border-t not-last:border-transparent"
		></span>
	{/each}
</div>
