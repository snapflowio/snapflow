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

interface ResourceFilterPanelProps {
	children: Snippet;
}

let { children }: ResourceFilterPanelProps = $props();
</script>

<div
	class="flex max-h-[70vh] w-60 max-w-[calc(100vw-0.75rem)] flex-col gap-3 overflow-x-hidden overflow-y-auto p-3"
>
	{@render children()}
</div>
