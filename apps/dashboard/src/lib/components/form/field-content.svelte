<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';

export type FieldContent = string | Snippet;

export function fieldContentText(content: FieldContent): string | undefined {
	return typeof content === 'string' ? content : undefined;
}
</script>

<script lang="ts">
interface FieldContentProps {
	content: FieldContent;
}

let { content }: FieldContentProps = $props();
</script>

{#if typeof content === 'string'}
	{content}
{:else}
	{@render content()}
{/if}
