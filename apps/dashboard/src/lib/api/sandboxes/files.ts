/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createFolder as createSandboxFolder,
	deleteFile,
	downloadFile,
	type FileInfo,
	getFileInfo,
	listFiles,
	moveFile,
	searchFiles,
	uploadFile,
} from '@snapflow/toolbox-api-client';
import {
	keepPreviousData,
	mutationOptions,
	type QueryClient,
	queryOptions,
	skipToken,
} from '@tanstack/svelte-query';
import { fetchWithTransferTimeout } from '#lib/api/client/api-client.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import {
	type SandboxToolboxClient,
	shouldRetryToolboxRequest,
} from '#lib/api/sandboxes/toolbox.ts';
import { BYTES_PER_MEBIBYTE } from '#lib/utils/format.ts';

export const ROOT_PATH = '/';
const DEFAULT_DIRECTORY_MODE = '0755';
export const FILE_SEARCH_MINIMUM_CHARACTERS = 3;
export const FILE_PREVIEW_MAXIMUM_BYTES = 10 * BYTES_PER_MEBIBYTE;
export const FILE_PREVIEW_VIRTUALIZATION_BYTES = 524_288;
export const FILE_PREVIEW_WRAP_MAXIMUM_BYTES = 262_144;
export const FILE_RICH_PREVIEW_MAXIMUM_BYTES = 524_288;

export type FilesystemNode = FileInfo & {
	id: string;
	path: string;
};

export type FilePreview =
	| { kind: 'binary' }
	| { kind: 'image'; blob: Blob }
	| { kind: 'text'; content: string };

export const ROOT_NODE: FilesystemNode = {
	group: '',
	id: ROOT_PATH,
	isDir: true,
	modifiedAt: '',
	mode: DEFAULT_DIRECTORY_MODE,
	name: 'Root',
	owner: '',
	path: ROOT_PATH,
	permissions: DEFAULT_DIRECTORY_MODE,
	size: 0,
};

const BINARY_SAMPLE_BYTES = 1024;
const IMAGE_MIME_TYPES: ReadonlyMap<string, string> = new Map(
	Object.entries({
		apng: 'image/apng',
		avif: 'image/avif',
		bmp: 'image/bmp',
		gif: 'image/gif',
		jpeg: 'image/jpeg',
		jpg: 'image/jpeg',
		png: 'image/png',
		svg: 'image/svg+xml',
		webp: 'image/webp',
	})
);

export function joinFilesystemPath(parentPath: string, name: string): string {
	return parentPath === ROOT_PATH ? `/${name}` : `${parentPath}/${name}`;
}

export function getFilesystemParentPath(path: string): string {
	const segments = path.split('/').filter(Boolean);
	return segments.length <= 1
		? ROOT_PATH
		: `/${segments.slice(0, -1).join('/')}`;
}

export function getFilesystemName(path: string): string {
	return path.split('/').filter(Boolean).at(-1) ?? ROOT_NODE.name;
}

export function getFilesystemAncestorPaths(path: string): string[] {
	const segments = path.split('/').filter(Boolean);
	return [
		ROOT_PATH,
		...[...segments.keys()].map(
			(index) => `/${segments.slice(0, index + 1).join('/')}`
		),
	];
}

function toFilesystemNode(parentPath: string, file: FileInfo): FilesystemNode {
	const path = joinFilesystemPath(parentPath, file.name);
	return { ...file, id: path, path };
}

export function toFallbackFilesystemNode(path: string): FilesystemNode {
	if (path === ROOT_PATH) return ROOT_NODE;
	return {
		...ROOT_NODE,
		id: path,
		isDir: false,
		name: getFilesystemName(path),
		path,
	};
}

function sortFilesystemEntries(entries: readonly FileInfo[]): FileInfo[] {
	return [...entries].sort((left, right) => {
		if (left.isDir !== right.isDir) return left.isDir ? -1 : 1;
		return left.name.localeCompare(right.name);
	});
}

export function isSameOrDescendantPath(path: string, parent: string): boolean {
	return parent === ROOT_PATH
		? path.startsWith(ROOT_PATH)
		: path === parent || path.startsWith(`${parent}/`);
}

function isProbablyBinary(bytes: Uint8Array): boolean {
	const sampleLength = Math.min(bytes.length, BINARY_SAMPLE_BYTES);
	for (let index = 0; index < sampleLength; index += 1) {
		if (bytes[index] === 0) return true;
	}
	return false;
}

function getImageMimeType(path: string): string | null {
	const extension = path.split('.').at(-1)?.toLowerCase();
	return extension ? (IMAGE_MIME_TYPES.get(extension) ?? null) : null;
}

const FILESYSTEM_CACHE_MILLISECONDS = 60_000;
const FILESYSTEM_QUERY_SCOPE = 'sandbox-filesystem';

export const filesystemQueryKeys = {
	all: (sandboxId: string) => [FILESYSTEM_QUERY_SCOPE, sandboxId] as const,
	details: (sandboxId: string, path: string) =>
		[...filesystemQueryKeys.all(sandboxId), 'details', path] as const,
	directory: (sandboxId: string, path: string) =>
		[...filesystemQueryKeys.all(sandboxId), 'directory', path] as const,
	preview: (sandboxId: string, path: string) =>
		[...filesystemQueryKeys.all(sandboxId), 'preview', path] as const,
	searches: (sandboxId: string) =>
		[...filesystemQueryKeys.all(sandboxId), 'search'] as const,
	search: (sandboxId: string, search: string) =>
		[...filesystemQueryKeys.searches(sandboxId), search] as const,
};

export function directoryQueryOptions(
	client: SandboxToolboxClient,
	path: string
) {
	return queryOptions({
		queryKey: filesystemQueryKeys.directory(client.sandboxId, path),
		queryFn: async () => {
			const response = await listFiles({
				client: client.client,
				query: { path },
			});
			return sortFilesystemEntries(response.data).map((entry) =>
				toFilesystemNode(path, entry)
			);
		},
		retry: shouldRetryToolboxRequest,
		staleTime: FILESYSTEM_CACHE_MILLISECONDS,
	});
}

async function fetchFilesystemNode(
	client: SandboxToolboxClient,
	path: string
): Promise<FilesystemNode> {
	if (path === ROOT_PATH) return ROOT_NODE;
	const response = await getFileInfo({
		client: client.client,
		query: { path },
	});
	return {
		...toFilesystemNode(getFilesystemParentPath(path), response.data),
		id: path,
		path,
	};
}

export function fileDetailsQueryOptions(
	client: SandboxToolboxClient,
	path: string | null
) {
	return queryOptions({
		queryKey: filesystemQueryKeys.details(client.sandboxId, path ?? ROOT_PATH),
		queryFn:
			path === null ? skipToken : () => fetchFilesystemNode(client, path),
		retry: shouldRetryToolboxRequest,
		staleTime: FILESYSTEM_CACHE_MILLISECONDS,
	});
}

export async function downloadSandboxFile(
	client: SandboxToolboxClient,
	path: string
): Promise<Blob> {
	const response = await downloadFile({
		client: client.client,
		query: { path },
		parseAs: 'blob',
		fetch: fetchWithTransferTimeout,
	});
	if (!(response.data instanceof Blob)) {
		throw new SnapflowError('The sandbox returned an invalid file download.');
	}
	return response.data;
}

async function fetchFilePreview(
	client: SandboxToolboxClient,
	path: string
): Promise<FilePreview> {
	const blob = await downloadSandboxFile(client, path);
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const imageMimeType = getImageMimeType(path);
	if (imageMimeType) {
		return { kind: 'image', blob: new Blob([bytes], { type: imageMimeType }) };
	}
	if (isProbablyBinary(bytes)) return { kind: 'binary' };
	return { kind: 'text', content: new TextDecoder().decode(bytes) };
}

function isPreviewable(node: FilesystemNode | null): node is FilesystemNode {
	return (
		node !== null && !node.isDir && node.size <= FILE_PREVIEW_MAXIMUM_BYTES
	);
}

export function filePreviewQueryOptions(
	client: SandboxToolboxClient,
	node: FilesystemNode | null
) {
	return queryOptions({
		queryKey: filesystemQueryKeys.preview(
			client.sandboxId,
			node?.path ?? ROOT_PATH
		),
		queryFn: isPreviewable(node)
			? () => fetchFilePreview(client, node.path)
			: skipToken,
		retry: shouldRetryToolboxRequest,
		staleTime: FILESYSTEM_CACHE_MILLISECONDS,
	});
}

export function fileSearchQueryOptions(
	client: SandboxToolboxClient,
	search: string
) {
	const normalizedSearch = search.trim();
	return queryOptions({
		queryKey: filesystemQueryKeys.search(client.sandboxId, normalizedSearch),
		queryFn:
			normalizedSearch.length < FILE_SEARCH_MINIMUM_CHARACTERS
				? skipToken
				: async () => {
						const response = await searchFiles({
							client: client.client,
							query: { path: ROOT_PATH, pattern: `*${normalizedSearch}*` },
						});
						return response.data.files;
					},
		placeholderData: keepPreviousData,
		retry: shouldRetryToolboxRequest,
		staleTime: FILESYSTEM_CACHE_MILLISECONDS,
	});
}

const PATH_QUERY_KINDS: ReadonlySet<string> = new Set([
	'details',
	'directory',
	'preview',
]);

interface CreateFolderVariables {
	name: string;
	parentPath: string;
}

interface DeleteNodeVariables {
	isDir: boolean;
	path: string;
}

interface MoveNodeVariables {
	destination: string;
	source: string;
}

interface UploadFilesVariables {
	files: readonly File[];
	parentPath: string;
}

function invalidateDirectory(
	queryClient: QueryClient,
	client: SandboxToolboxClient,
	path: string
): Promise<void> {
	return queryClient.invalidateQueries({
		queryKey: filesystemQueryKeys.directory(client.sandboxId, path),
	});
}

function removePathQueries(
	queryClient: QueryClient,
	client: SandboxToolboxClient,
	path: string
): void {
	queryClient.removeQueries({
		predicate: (query) => {
			const [scope, sandboxId, kind, queryPath] = query.queryKey;
			return (
				scope === FILESYSTEM_QUERY_SCOPE &&
				sandboxId === client.sandboxId &&
				typeof kind === 'string' &&
				PATH_QUERY_KINDS.has(kind) &&
				typeof queryPath === 'string' &&
				isSameOrDescendantPath(queryPath, path)
			);
		},
	});
}

function filesystemMutationMeta(client: SandboxToolboxClient, failure: string) {
	return {
		failure,
		invalidates: [filesystemQueryKeys.searches(client.sandboxId)],
	};
}

export function createFolderMutationOptions(
	client: SandboxToolboxClient,
	queryClient: QueryClient
) {
	return mutationOptions({
		mutationFn: async ({ name, parentPath }: CreateFolderVariables) => {
			const path = joinFilesystemPath(parentPath, name);
			await createSandboxFolder({
				client: client.client,
				query: { path, mode: DEFAULT_DIRECTORY_MODE },
			});
			return { parentPath, path };
		},
		onSuccess: ({ parentPath }) =>
			invalidateDirectory(queryClient, client, parentPath),
		meta: filesystemMutationMeta(client, 'Failed to create folder'),
	});
}

export function deleteNodeMutationOptions(
	client: SandboxToolboxClient,
	queryClient: QueryClient
) {
	return mutationOptions({
		mutationFn: async ({ isDir, path }: DeleteNodeVariables) => {
			await deleteFile({
				client: client.client,
				query: { path, recursive: isDir },
			});
			return path;
		},
		onSuccess: (path) => {
			removePathQueries(queryClient, client, path);
			return invalidateDirectory(
				queryClient,
				client,
				getFilesystemParentPath(path)
			);
		},
		meta: filesystemMutationMeta(client, 'Failed to delete item'),
	});
}

function moveMutationOptions(
	client: SandboxToolboxClient,
	queryClient: QueryClient,
	failure: string
) {
	return mutationOptions({
		mutationFn: async ({ destination, source }: MoveNodeVariables) => {
			await moveFile({
				client: client.client,
				query: { source, destination },
			});
			return { destination, source };
		},
		onSuccess: async ({ destination, source }) => {
			removePathQueries(queryClient, client, source);
			await Promise.all([
				invalidateDirectory(
					queryClient,
					client,
					getFilesystemParentPath(source)
				),
				invalidateDirectory(
					queryClient,
					client,
					getFilesystemParentPath(destination)
				),
			]);
		},
		meta: filesystemMutationMeta(client, failure),
	});
}

export function moveNodeMutationOptions(
	client: SandboxToolboxClient,
	queryClient: QueryClient
) {
	return moveMutationOptions(client, queryClient, 'Failed to move item');
}

export function renameNodeMutationOptions(
	client: SandboxToolboxClient,
	queryClient: QueryClient
) {
	return moveMutationOptions(client, queryClient, 'Failed to rename item');
}

export function uploadFilesMutationOptions(
	client: SandboxToolboxClient,
	queryClient: QueryClient
) {
	return mutationOptions({
		mutationFn: async ({ files, parentPath }: UploadFilesVariables) => {
			await Promise.all(
				files.map((file) =>
					uploadFile({
						client: client.client,
						query: { path: joinFilesystemPath(parentPath, file.name) },
						body: { file },
						fetch: fetchWithTransferTimeout,
					})
				)
			);
			return parentPath;
		},
		onSuccess: (parentPath) =>
			invalidateDirectory(queryClient, client, parentPath),
		meta: filesystemMutationMeta(client, 'Failed to upload files'),
	});
}
