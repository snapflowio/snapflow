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

<div class="flex items-center gap-6" aria-hidden="true">
	<div class="grow border-border border-t"></div>
	<span class="text-(--text-subtle) text-sm">{label}</span>
	<div class="grow border-border border-t"></div>
</div>
