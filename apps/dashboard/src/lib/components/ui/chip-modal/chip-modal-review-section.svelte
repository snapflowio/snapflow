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

interface ChipModalReviewSectionProps {
	title: string;
	children: Snippet;
}

let { title, children }: ChipModalReviewSectionProps = $props();
</script>

<section class="rounded-lg border border-border bg-surface-3 p-3">
	<h3 class="mb-1 text-(--text-primary) text-small">{title}</h3>
	<dl class="divide-y divide-(--border-muted)">{@render children()}</dl>
</section>
