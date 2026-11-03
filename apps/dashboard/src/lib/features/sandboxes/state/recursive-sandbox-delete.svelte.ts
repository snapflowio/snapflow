/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '@snapflow/api-client';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import {
	collectSandboxForks,
	deleteSandboxById,
} from '#lib/api/sandboxes/sandboxes.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';

export interface RecursiveSandboxDeleteArgs {
	onDeleted: () => void;
	sandbox: Sandbox;
}

async function collectSandboxesBottomUp(
	sandbox: Sandbox,
	signal: AbortSignal
): Promise<Sandbox[]> {
	const collected: Sandbox[] = [];
	const collectChildren = async (sandboxId: string): Promise<void> => {
		for (const child of await collectSandboxForks(sandboxId, signal)) {
			await collectChildren(child.id);
			collected.push(child);
		}
	};
	await collectChildren(sandbox.id);
	collected.push(sandbox);
	return collected;
}

export class RecursiveSandboxDelete {
	isOpen = $state(false);
	loading = $state(false);
	deleting = $state(false);
	progress = $state(0);
	sandboxes = $state.raw<readonly Sandbox[]>([]);
	readonly #args: () => RecursiveSandboxDeleteArgs;
	#controller = new AbortController();

	constructor(args: () => RecursiveSandboxDeleteArgs) {
		this.#args = args;
	}

	open = async (): Promise<void> => {
		this.#controller.abort();
		this.#controller = new AbortController();
		const { signal } = this.#controller;
		this.isOpen = true;
		this.loading = true;
		this.progress = 0;
		try {
			const sandboxes = await collectSandboxesBottomUp(
				this.#args().sandbox,
				signal
			);
			if (!signal.aborted) this.sandboxes = sandboxes;
		} catch (error) {
			if (!signal.aborted) {
				showApiError(error, 'Failed to load sandbox fork tree');
			}
		} finally {
			if (!signal.aborted) this.loading = false;
		}
	};

	close = (): void => {
		if (this.deleting) return;
		this.#controller.abort();
		this.isOpen = false;
	};

	deleteTree = async (): Promise<void> => {
		this.deleting = true;
		this.progress = 0;
		let failed = 0;
		for (const [index, target] of this.sandboxes.entries()) {
			try {
				await deleteSandboxById(target.id);
			} catch (error) {
				failed += 1;
				showApiError(error, `Failed to delete ${target.name}`);
			}
			this.progress = index + 1;
		}
		this.deleting = false;
		const succeeded = this.sandboxes.length - failed;
		toast({
			message:
				failed > 0
					? `${succeeded} sandboxes deleted; ${failed} failed`
					: `${succeeded} sandboxes deleted`,
			variant: failed > 0 ? 'error' : 'success',
		});
		if (failed === 0) {
			this.close();
			this.#args().onDeleted();
		}
	};
}
