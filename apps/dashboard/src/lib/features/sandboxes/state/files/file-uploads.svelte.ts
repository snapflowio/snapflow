/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createMutation, type QueryClient } from '@tanstack/svelte-query';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import {
	directoryQueryOptions,
	type FileUploadProgress,
	type FileUploadResult,
	uploadFilesMutationOptions,
} from '#lib/api/sandboxes/files.ts';
import type { SandboxToolboxClient } from '#lib/api/sandboxes/toolbox.ts';
import type { ToastInput } from '#lib/components/ui/toast/toast-model.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const PERSISTENT_TOAST_DURATION = 0;
const LIST_SEPARATOR = ', ';

export interface PendingFileUpload {
	conflicts: readonly string[];
	files: readonly File[];
	parentPath: string;
}

interface FileUploadsOptions {
	client: SandboxToolboxClient;
	queryClient: QueryClient;
	onUploaded: (result: FileUploadResult) => Promise<void>;
}

function progressToast({ completed, total }: FileUploadProgress): ToastInput {
	return {
		message: `Uploading ${completed} of ${pluralize(total, 'file')}...`,
		variant: 'info',
		duration: PERSISTENT_TOAST_DURATION,
	};
}

function resultToast({ failed, uploaded }: FileUploadResult): ToastInput {
	const total = uploaded.length + failed.length;
	if (failed.length === 0) {
		const [only] = uploaded;
		return {
			message: `Uploaded ${uploaded.length === 1 && only ? only.name : pluralize(total, 'file')}`,
			variant: 'success',
		};
	}
	return {
		message: `Uploaded ${uploaded.length} of ${pluralize(total, 'file')}`,
		description: `Failed: ${failed.map(({ file }) => file.name).join(LIST_SEPARATOR)}`,
		variant: 'warning',
	};
}

export class FileUploads {
	readonly #options: () => FileUploadsOptions;
	readonly #mutation;
	#progressToastId: string | null = null;

	pending = $state.raw<PendingFileUpload | null>(null);

	constructor(options: () => FileUploadsOptions) {
		this.#options = options;
		this.#mutation = createMutation(() =>
			uploadFilesMutationOptions(options().client, options().queryClient)
		);
	}

	get isPending(): boolean {
		return this.#mutation.isPending;
	}

	request = async (
		files: readonly File[],
		parentPath: string
	): Promise<void> => {
		if (files.length === 0) return;
		const { client, queryClient } = this.#options();
		let existing: readonly { name: string }[];
		try {
			existing = await queryClient.fetchQuery(
				directoryQueryOptions(client, parentPath)
			);
		} catch (error) {
			showApiError(error, 'Failed to check the upload folder');
			return;
		}
		const existingNames = new Set(existing.map((entry) => entry.name));
		const conflicts = files
			.map((file) => file.name)
			.filter((name) => existingNames.has(name));
		if (conflicts.length > 0) {
			this.pending = { conflicts, files, parentPath };
			return;
		}
		await this.#upload(files, parentPath);
	};

	confirm = async (): Promise<void> => {
		const pending = this.pending;
		if (!pending) return;
		this.pending = null;
		await this.#upload(pending.files, pending.parentPath);
	};

	changePendingOpen = (open: boolean): void => {
		if (!open) this.pending = null;
	};

	async #upload(files: readonly File[], parentPath: string): Promise<void> {
		this.#clearProgress();
		this.#progressToastId = toast(
			progressToast({ completed: 0, total: files.length })
		);
		let result: FileUploadResult;
		try {
			result = await this.#mutation.mutateAsync({
				files,
				parentPath,
				onProgress: (progress) => this.#showProgress(progress),
			});
		} catch {
			this.#clearProgress();
			return;
		}
		this.#settleProgress(resultToast(result));
		await this.#options().onUploaded(result);
	}

	#showProgress(progress: FileUploadProgress): void {
		if (this.#progressToastId === null) return;
		if (!toast.update(this.#progressToastId, progressToast(progress))) {
			this.#progressToastId = null;
		}
	}

	#settleProgress(input: ToastInput): void {
		const id = this.#progressToastId;
		this.#progressToastId = null;
		if (id === null || !toast.update(id, input)) toast(input);
	}

	#clearProgress(): void {
		if (this.#progressToastId === null) return;
		toast.dismiss(this.#progressToastId);
		this.#progressToastId = null;
	}
}
