<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const EMPTY_LINE_CONTENT = '\n';
</script>

<script lang="ts">
import {
	type HighlightedCode,
	highlightCode,
	plainCode,
} from '#lib/features/sandboxes/lib/files/highlighter.ts';
import HastNode from './hast-node.svelte';

interface CodePreviewProps {
	code: string;
	language: string;
}

let { code, language }: CodePreviewProps = $props();

const plain = $derived(plainCode(code));
const highlighted = $derived(highlightCode(code, language));
</script>

{#snippet lines(
	result: HighlightedCode
)}
	<pre
		class="h-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap wrap-break-word bg-surface-1 p-4 font-mono text-caption leading-6"
		style:color={result.foreground}
	>{#each result.lines as line, lineIndex (lineIndex)}<div
				class="wrap-break-word whitespace-pre-wrap token-line">{#each line as node, nodeIndex (nodeIndex)}<HastNode
						{node} />{:else}<span class="inline-block"
						>{EMPTY_LINE_CONTENT}</span
					>{/each}</div>{/each}</pre>
{/snippet}

{#await highlighted}
	{@render lines(plain)}
{:then result}
	{@render lines(result)}
{/await}
