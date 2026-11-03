<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FolderPlus from '@lucide/svelte/icons/folder-plus';
import ListCollapse from '@lucide/svelte/icons/list-collapse';
import Upload from '@lucide/svelte/icons/upload';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import Redo from '#lib/components/icons/redo.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import type { FilesystemExplorer } from '#lib/features/sandboxes/state/files/filesystem-explorer.svelte.ts';

interface FilesystemToolbarProps {
	busy: boolean;
	explorer: FilesystemExplorer;
	onCreateFolder: () => void;
	onRefresh: () => void;
	onUpload: (files: readonly File[]) => void;
}

let {
	busy,
	explorer,
	onCreateFolder,
	onRefresh,
	onUpload,
}: FilesystemToolbarProps = $props();

let uploadInput = $state<HTMLInputElement | null>(null);
</script>

{#snippet iconChip(
	label: string,
	icon: IconComponent,
	onclick: () => void,
	disabled = false
)}
	<Tooltip content={label}>
		{#snippet child({
			props,
		})}
			<Chip
				{...props}
				aria-label={label}
				leftIcon={icon}
				{disabled}
				{onclick}
			/>
		{/snippet}
	</Tooltip>
{/snippet}

{#snippet tools()}
	{@render iconChip('Refresh', Redo, onRefresh, busy)}
	{@render iconChip('Collapse all', ListCollapse, explorer.tree.collapseAll)}
	<Chip leftIcon={FolderPlus} disabled={busy} onclick={onCreateFolder}>
		New folder
	</Chip>
	<Chip leftIcon={Upload} disabled={busy} onclick={() => uploadInput?.click()}>
		Upload
	</Chip>
	<input
		bind:this={uploadInput}
		type="file"
		multiple
		class="sr-only"
		tabindex="-1"
		onchange={(event) => {
			const files = Array.from(event.currentTarget.files ?? []);
			event.currentTarget.value = '';
			onUpload(files);
		}}
	>
{/snippet}

<ResourceOptionsBar
	search={{
		value: explorer.search.value,
		onChange: (value) => (explorer.search.value = value),
		placeholder: 'Search files...',
		ariaLabel: 'Search sandbox files',
	}}
	extras={tools}
/>
