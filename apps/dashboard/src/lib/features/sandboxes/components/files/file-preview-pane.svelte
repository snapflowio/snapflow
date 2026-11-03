<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MARKDOWN_LANGUAGE = 'markdown';
const PREVIEW_FAILED_MESSAGE = 'This file could not be previewed';
</script>

<script lang="ts">
import Download from '@lucide/svelte/icons/download';
import { createQuery } from '@tanstack/svelte-query';
import {
	FILE_PREVIEW_MAXIMUM_BYTES,
	FILE_PREVIEW_VIRTUALIZATION_BYTES,
	FILE_PREVIEW_WRAP_MAXIMUM_BYTES,
	FILE_RICH_PREVIEW_MAXIMUM_BYTES,
	type FilesystemNode,
	filePreviewQueryOptions,
} from '#lib/api/sandboxes/files.ts';
import type { SandboxToolboxClient } from '#lib/api/sandboxes/toolbox.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Redo from '#lib/components/icons/redo.svelte';
import Loading from '#lib/components/loading.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { getCodeLanguage } from '#lib/features/sandboxes/lib/files/highlighter.ts';
import { formatBytes } from '#lib/utils/format.ts';
import DirectoryUpload from './directory-upload.svelte';
import FilePreviewHeader from './file-preview-header.svelte';
import ImagePreview from './image-preview.svelte';
import TextPreview from './text-preview.svelte';

interface FilePreviewPaneProps {
	client: SandboxToolboxClient;
	filePaths: readonly string[];
	node: FilesystemNode | null;
	onDownload: (node: FilesystemNode) => void;
	onSelect: (path: string) => void;
	onUpload?: (files: readonly File[]) => void;
	editable: boolean;
	onRename: () => void;
	onDelete: () => void;
}

let {
	client,
	filePaths,
	node,
	onDownload,
	onSelect,
	onUpload,
	editable,
	onRename,
	onDelete,
}: FilePreviewPaneProps = $props();

const previewQuery = createQuery(() => filePreviewQueryOptions(client, node));
const nodePath = $derived(node?.path);
let wrapLines = $derived(nodePath !== undefined);
</script>

{#snippet richPreviewFailed()}
	<FeedbackState class="h-full" tone="error" message={PREVIEW_FAILED_MESSAGE} />
{/snippet}

{#snippet textFileBody(
	file: FilesystemNode,
	content: string,
	wrap: boolean
)}
	{const language = $derived(getCodeLanguage(file.path))}
	{const canRenderRichPreview = $derived(
		file.size <= FILE_RICH_PREVIEW_MAXIMUM_BYTES
	)}
	{#if language === MARKDOWN_LANGUAGE && canRenderRichPreview}
		{#await import(
			'./markdown-preview.svelte'
		) then { default: MarkdownPreview }}
			<MarkdownPreview {content} />
		{:catch}
			{@render richPreviewFailed()}
		{/await}
	{:else if language && canRenderRichPreview}
		{#await import('./code-preview.svelte') then { default: CodePreview }}
			<CodePreview code={content} {language} />
		{:catch}
			{@render richPreviewFailed()}
		{/await}
	{:else}
		<TextPreview
			{content}
			virtualized={file.size >= FILE_PREVIEW_VIRTUALIZATION_BYTES}
			wrapLines={wrap}
		/>
	{/if}
{/snippet}

{#if !node}
	<FeedbackState class="h-full" message="Select a file or folder" />
{:else if node.isDir}
	<div class="flex h-full min-h-0 flex-col">
		<FilePreviewHeader {node} {editable} {onRename} {onDelete} />
		<div class="min-h-0 flex-1">
			<DirectoryUpload {node} {onUpload} />
		</div>
	</div>
{:else}
	{const file = $derived(node)}
	{const preview = $derived(previewQuery.data)}
	{const canWrap = $derived(file.size <= FILE_PREVIEW_WRAP_MAXIMUM_BYTES)}
	<div class="flex h-full min-h-0 flex-col">
		<FilePreviewHeader
			node={file}
			{editable}
			{onRename}
			{onDelete}
			{filePaths}
			{onSelect}
			{onDownload}
			textContent={preview?.kind === 'text' ? preview.content : null}
			{canWrap}
			{wrapLines}
			onToggleWrap={() => {
				wrapLines = !wrapLines;
			}}
		/>
		<div class="min-h-0 flex-1 overflow-hidden">
			{#if file.size > FILE_PREVIEW_MAXIMUM_BYTES}
				<FeedbackState
					class="h-full"
					message={`${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(FILE_PREVIEW_MAXIMUM_BYTES)} preview limit`}
				>
					{#snippet action()}
						<Chip leftIcon={Download} onclick={() => onDownload(file)}>
							Download
						</Chip>
					{/snippet}
				</FeedbackState>
			{:else if previewQuery.isPending}
				<Loading />
			{:else if previewQuery.isError || !preview}
				<FeedbackState
					class="h-full"
					tone="error"
					message={PREVIEW_FAILED_MESSAGE}
				>
					{#snippet action()}
						<Chip leftIcon={Redo} onclick={() => void previewQuery.refetch()}>
							Try again
						</Chip>
					{/snippet}
				</FeedbackState>
			{:else if preview.kind === 'binary'}
				<FeedbackState
					class="h-full"
					message="Binary files cannot be previewed"
				/>
			{:else if preview.kind === 'image'}
				<ImagePreview blob={preview.blob} name={file.name} />
			{:else}
				{@render textFileBody(file, preview.content, canWrap && wrapLines)}
			{/if}
		</div>
	</div>
{/if}
