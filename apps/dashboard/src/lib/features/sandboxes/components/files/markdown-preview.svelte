<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Root } from 'hast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);

function parseMarkdown(content: string): Root {
	return processor.runSync(processor.parse(content));
}
</script>

<script lang="ts">
import HastNode from './hast-node.svelte';

interface MarkdownPreviewProps {
	readonly content: string;
}

let { content }: MarkdownPreviewProps = $props();

const tree = $derived(parseMarkdown(content));
</script>

<div
	class="h-full overflow-x-hidden overflow-y-auto wrap-break-word p-4 text-(--text-body) text-caption leading-6 [&_a]:text-(--brand-accent) [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-4 [&_blockquote]:border-border [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_hr]:my-6 [&_hr]:border-border [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:wrap-break-word [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:wrap-break-word [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
>
	<HastNode node={tree} />
</div>
