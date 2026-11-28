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
import KeyValueList from '#lib/components/page/key-value-list.svelte';

interface ChipModalReviewSectionProps {
	title: string;
	children: Snippet;
}

let { title, children }: ChipModalReviewSectionProps = $props();
</script>

<section class="flex flex-col gap-y-2">
	<h3 class="font-medium text-(--text-primary) text-sm">{title}</h3>
	<KeyValueList framed={false} review> {@render children()} </KeyValueList>
</section>
