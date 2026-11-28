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

interface ResourceFilterFieldProps {
	children: Snippet;
	label: string;
}

let { children, label }: ResourceFilterFieldProps = $props();
</script>

<div class="flex flex-col gap-2">
	<span class="font-medium text-(--text-muted) text-xs">{label}</span>
	{@render children()}
</div>
