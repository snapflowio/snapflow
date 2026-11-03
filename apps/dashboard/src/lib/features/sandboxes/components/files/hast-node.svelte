<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'track',
	'wbr',
]);
</script>

<script lang="ts">
import type { Root, RootContent } from 'hast';
import {
	cellTextAlign,
	codeBlock,
	elementAttributes,
	elementStyle,
	linkHref,
	renderedChildren,
} from '#lib/features/sandboxes/lib/files/hast.ts';
import CodePreview from './code-preview.svelte';
import HastNode from './hast-node.svelte';

interface HastNodeProps {
	node: Root | RootContent;
}

let { node }: HastNodeProps = $props();
</script>

{#snippet children(
	nodes: readonly RootContent[]
)}
	{#each nodes as child, index (index)}
		<HastNode node={child} />
	{/each}
{/snippet}

{#if node.type === 'root'}
	{@render children(node.children)}
{:else if node.type === 'text'}
	{node.value}
{:else if node.type === 'element'}
	{#if node.tagName === 'a'}
		<a href={linkHref(node)} target="_blank" rel="noopener noreferrer"
			>{@render children(node.children)}</a
		>
	{:else if node.tagName === 'pre'}
		<div class="my-4">{@render children(node.children)}</div>
	{:else if node.tagName === 'code'}
		{const block = $derived(codeBlock(node))}
		{#if block}
			<CodePreview code={block.code} language={block.language} />
		{:else}
			<code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-micro"
				>{@render children(node.children)}</code
			>
		{/if}
	{:else if VOID_ELEMENTS.has(node.tagName)}
		<svelte:element this={node.tagName} {...elementAttributes(node)} />
	{:else}
		<svelte:element
			this={node.tagName}
			{...elementAttributes(node)}
			style={elementStyle(node)}
			style:text-align={cellTextAlign(node)}
			>{@render children(renderedChildren(node))}</svelte:element
		>
	{/if}
{/if}
