<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
interface AuthDividerProps {
	label: string;
}

let { label }: AuthDividerProps = $props();
</script>

<div class="relative" aria-hidden="true">
	<div class="absolute inset-0 flex items-center">
		<div class="w-full border-border border-t"></div>
	</div>
	<div class="relative flex justify-center">
		<span class="bg-bg px-4 text-sm text-(--text-muted)">
			{label}
		</span>
	</div>
</div>
