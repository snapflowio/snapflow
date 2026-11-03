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

interface ChipInputSuffixProps {
	children: Snippet;
}

let { children }: ChipInputSuffixProps = $props();
</script>

<span class="shrink-0 text-(--text-muted) text-caption">
	{@render children()}
</span>
