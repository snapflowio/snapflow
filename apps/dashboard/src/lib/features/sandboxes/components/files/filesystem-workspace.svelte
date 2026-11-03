<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';
import { ROOT_PATH } from '#lib/api/sandboxes/files.ts';

const OBJECT_URL_REVOKE_DELAY_MILLISECONDS = 0;

const filesystemSearchSchema = z.object({
	path: z.string().startsWith(ROOT_PATH).optional().catch(undefined),
});

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	window.setTimeout(
		() => URL.revokeObjectURL(url),
		OBJECT_URL_REVOKE_DELAY_MILLISECONDS
	);
}
</script>

<script lang="ts">
import {
	createMutation,
	createQuery,
	useQueryClient,
} from '@tanstack/svelte-query';
import { onMount } from 'svelte';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import {
	createFolderMutationOptions,
	deleteNodeMutationOptions,
	downloadSandboxFile,
	type FilesystemNode,
	fileDetailsQueryOptions,
	filesystemQueryKeys,
	getFilesystemName,
	getFilesystemParentPath,
	isSameOrDescendantPath,
	joinFilesystemPath,
	moveNodeMutationOptions,
	renameNodeMutationOptions,
	uploadFilesMutationOptions,
} from '#lib/api/sandboxes/files.ts';
import type { SandboxToolboxClient } from '#lib/api/sandboxes/toolbox.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Redo from '#lib/components/icons/redo.svelte';
import Loading from '#lib/components/loading.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { FilesystemExplorer } from '#lib/features/sandboxes/state/files/filesystem-explorer.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import FilePreviewPane from './file-preview-pane.svelte';
import FilesystemPromptModal from './filesystem-prompt-modal.svelte';
import FilesystemToolbar from './filesystem-toolbar.svelte';
import FilesystemTree from './filesystem-tree.svelte';

interface FilesystemWorkspaceProps {
	client: SandboxToolboxClient;
}

let { client }: FilesystemWorkspaceProps = $props();

const queryClient = useQueryClient();
const searchParams = new SearchParams(filesystemSearchSchema);
const selectedPath = $derived(searchParams.current.path ?? null);
let visibleFilePaths = $state.raw<readonly string[]>([]);
let deleteOpen = $state(false);
let createDialog = $state<FilesystemPromptModal>();
let renameDialog = $state<FilesystemPromptModal>();

const selectedNodeQuery = createQuery(() =>
	fileDetailsQueryOptions(client, selectedPath)
);
const selectedNode = $derived(
	selectedPath ? (selectedNodeQuery.data ?? null) : null
);
const createFolderMutation = createMutation(() =>
	createFolderMutationOptions(client, queryClient)
);
const deleteMutation = createMutation(() =>
	deleteNodeMutationOptions(client, queryClient)
);
const renameMutation = createMutation(() =>
	renameNodeMutationOptions(client, queryClient)
);
const moveMutation = createMutation(() =>
	moveNodeMutationOptions(client, queryClient)
);
const uploadMutation = createMutation(() =>
	uploadFilesMutationOptions(client, queryClient)
);
const targetDirectory = $derived.by(() => {
	if (!selectedNode) return ROOT_PATH;
	return selectedNode.isDir
		? selectedNode.path
		: getFilesystemParentPath(selectedNode.path);
});
const anyMutationPending = $derived(
	createFolderMutation.isPending ||
		deleteMutation.isPending ||
		renameMutation.isPending ||
		moveMutation.isPending ||
		uploadMutation.isPending
);
const editable = $derived(
	selectedNode !== null &&
		selectedNode.path !== ROOT_PATH &&
		!anyMutationPending
);

const select = (path: string | null) => {
	if (path === selectedPath) return;
	void searchParams.update({ path: path ?? undefined });
};

const createFolder = async (name: string) => {
	const created = await createFolderMutation.mutateAsync({
		name,
		parentPath: targetDirectory,
	});
	await explorer.refreshPath(created.parentPath);
	await explorer.expandPathAncestors(created.path);
	select(created.path);
	toast.success(`Created ${name}`);
};
const renameNode = async (name: string) => {
	if (!selectedNode) return;
	const parentPath = getFilesystemParentPath(selectedNode.path);
	const destination = joinFilesystemPath(parentPath, name);
	await renameMutation.mutateAsync({
		destination,
		source: selectedNode.path,
	});
	await explorer.refreshPath(parentPath);
	select(destination);
	toast.success(`Renamed to ${name}`);
};
const deleteNode = async () => {
	if (!selectedNode) return;
	const node = selectedNode;
	try {
		await deleteMutation.mutateAsync(node);
	} catch {
		return;
	}
	await explorer.refreshPath(getFilesystemParentPath(node.path));
	select(null);
	visibleFilePaths = [];
	deleteOpen = false;
	toast.success(`Deleted ${node.name}`);
};
const moveNode = async (source: string, destination: string) => {
	if (isSameOrDescendantPath(destination, source)) {
		toast.error('A folder cannot be moved inside itself.');
		return;
	}
	await moveMutation.mutateAsync({ destination, source });
	if (selectedPath && isSameOrDescendantPath(selectedPath, source)) {
		select(`${destination}${selectedPath.slice(source.length)}`);
	}
	toast.success(`Moved ${getFilesystemName(source)}`);
};
const explorer = new FilesystemExplorer(() => ({
	client,
	onMove: moveNode,
	onSelect: (path, filePaths) => {
		select(path);
		visibleFilePaths = filePaths;
	},
}));
const uploadFiles = async (files: readonly File[]) => {
	if (files.length === 0) return;
	const parentPath = targetDirectory;
	try {
		await uploadMutation.mutateAsync({ files, parentPath });
	} catch {
		return;
	}
	const [firstFile] = files;
	if (firstFile) {
		const firstPath = joinFilesystemPath(parentPath, firstFile.name);
		await explorer.refreshPath(parentPath);
		await explorer.expandPathAncestors(firstPath);
		select(firstPath);
		explorer.revealPath(firstPath);
	}
	toast.success(
		`Uploaded ${files.length === 1 ? files[0]?.name : `${files.length} files`}`
	);
};
const downloadNode = async (node: FilesystemNode) => {
	try {
		downloadBlob(await downloadSandboxFile(client, node.path), node.name);
		toast.success(`Downloaded ${node.name}`);
	} catch (error) {
		showApiError(error, 'Failed to download file');
	}
};
const refresh = async () => {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: filesystemQueryKeys.all(client.sandboxId),
		}),
		explorer.refreshPath(ROOT_PATH),
	]);
};

onMount(() => {
	if (selectedPath === null) return;
	const path = selectedPath;
	void explorer.expandPathAncestors(path).then(() => {
		explorer.select(path);
		explorer.revealPath(path);
	});
});
</script>

<div class="flex h-full min-h-0 flex-col">
	<FilesystemToolbar
		busy={anyMutationPending}
		{explorer}
		onCreateFolder={() => createDialog?.show()}
		onRefresh={() => void refresh()}
		onUpload={(files) => void uploadFiles(files)}
	/>
	<div
		class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(220px,40%)_minmax(0,1fr)] md:grid-cols-[minmax(260px,32%)_minmax(0,1fr)] md:grid-rows-1"
	>
		<FilesystemTree {explorer} {selectedPath} />
		<div class="min-h-0 overflow-hidden bg-bg">
			{#if selectedNodeQuery.isFetching && selectedPath && !selectedNode}
				<Loading />
			{:else if selectedNodeQuery.isError}
				<FeedbackState
					class="h-full"
					tone="error"
					message="This item could not be loaded"
				>
					{#snippet action()}
						<Chip
							leftIcon={Redo}
							onclick={() => void selectedNodeQuery.refetch()}
						>
							Try again
						</Chip>
					{/snippet}
				</FeedbackState>
			{:else}
				<FilePreviewPane
					{client}
					filePaths={visibleFilePaths}
					node={selectedNode}
					{editable}
					onRename={() => renameDialog?.show(selectedNode?.name)}
					onDelete={() => {
						deleteOpen = true;
					}}
					onDownload={(node) => void downloadNode(node)}
					onSelect={(path) => {
						select(path);
						explorer.revealPath(path);
					}}
					onUpload={(files) => void uploadFiles(files)}
				/>
			{/if}
		</div>
	</div>
	<FilesystemPromptModal
		bind:this={createDialog}
		mode="create"
		onSubmit={createFolder}
	/>
	<FilesystemPromptModal
		bind:this={renameDialog}
		mode="rename"
		onSubmit={renameNode}
	/>
	<ChipModalConfirm
		bind:open={deleteOpen}
		onsubmit={() => void deleteNode()}
		title={selectedNode?.isDir ? 'Delete folder' : 'Delete file'}
		text={selectedNode
			? [
					'Are you sure you want to delete ',
					{ text: selectedNode.name, bold: true },
					'? ',
					selectedNode.isDir
						? { text: 'Everything inside it will be deleted too.', error: true }
						: { text: 'This cannot be undone.', error: true },
				]
			: undefined}
		pending={deleteMutation.isPending}
	>
		{#snippet confirm()}
			<ChipModalAction
				type="submit"
				variant="destructive"
				disabled={deleteMutation.isPending}
			>
				{deleteMutation.isPending ? 'Deleting...' : 'Delete'}
			</ChipModalAction>
		{/snippet}
	</ChipModalConfirm>
</div>
