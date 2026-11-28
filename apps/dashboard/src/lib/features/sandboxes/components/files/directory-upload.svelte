<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Upload from '@lucide/svelte/icons/upload';
import type { FilesystemNode } from '#lib/api/sandboxes/files.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';

interface DirectoryUploadProps {
	node: FilesystemNode;
	onUpload?: (files: readonly File[]) => void;
}

let { node, onUpload }: DirectoryUploadProps = $props();

let input = $state<HTMLInputElement | null>(null);

const handleDrop = (event: DragEvent) => {
	if (!onUpload) return;
	event.preventDefault();
	onUpload(Array.from(event.dataTransfer?.files ?? []));
};
</script>

{#snippet message()}
	{onUpload ? 'Drop files into ' : 'Directory '}<span
		class="break-all font-mono"
		>{node.path}</span
	>{onUpload ? ' or choose files to upload.' : ' is selected.'}
{/snippet}

{#snippet uploadAction()}
	<Chip leftIcon={Upload} onclick={() => input?.click()}>Upload files</Chip>
	<input
		bind:this={input}
		type="file"
		multiple
		class="sr-only"
		onchange={(event) => {
			onUpload?.(Array.from(event.currentTarget.files ?? []));
			event.currentTarget.value = '';
		}}
	>
{/snippet}

<section
	aria-label={onUpload
		? `Upload files to ${node.path}`
		: `Directory ${node.path}`}
	class="flex h-full items-center justify-center p-6"
	ondragover={onUpload ? (event) => event.preventDefault() : undefined}
	ondrop={onUpload ? handleDrop : undefined}
>
	<FeedbackState
		class="h-full w-full border border-border border-dashed"
		{message}
		action={onUpload ? uploadAction : undefined}
	/>
</section>
