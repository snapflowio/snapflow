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
	fetchSandboxAncestors,
} from '#lib/api/sandboxes/sandboxes.ts';

export class ForkTreeNode {
	readonly sandbox: Sandbox;
	children = $state.raw<readonly ForkTreeNode[]>([]);
	expanded = $state(false);
	loading = $state(false);
	readonly #signal: AbortSignal;

	constructor(sandbox: Sandbox, signal: AbortSignal) {
		this.sandbox = sandbox;
		this.#signal = signal;
	}

	toggle = async (): Promise<void> => {
		if (this.expanded || this.children.length > 0) {
			this.expanded = !this.expanded;
			return;
		}
		this.loading = true;
		try {
			const forks = await collectSandboxForks(this.sandbox.id, this.#signal);
			this.children = forks.map((fork) => new ForkTreeNode(fork, this.#signal));
			this.expanded = true;
		} catch (error) {
			if (!this.#signal.aborted) {
				showApiError(error, 'Failed to load sandbox forks');
			}
		} finally {
			this.loading = false;
		}
	};
}

export class ForkTree {
	isOpen = $state(false);
	loading = $state(false);
	ancestors = $state.raw<readonly Sandbox[]>([]);
	children = $state.raw<readonly ForkTreeNode[]>([]);
	readonly #sandboxId: () => string;
	#controller = new AbortController();

	constructor(sandboxId: () => string) {
		this.#sandboxId = sandboxId;
	}

	open = async (): Promise<void> => {
		this.#controller.abort();
		this.#controller = new AbortController();
		const { signal } = this.#controller;
		const sandboxIdOrName = this.#sandboxId();
		this.isOpen = true;
		this.loading = true;
		try {
			const [ancestors, forks] = await Promise.all([
				fetchSandboxAncestors(sandboxIdOrName, signal),
				collectSandboxForks(sandboxIdOrName, signal),
			]);
			if (signal.aborted) return;
			this.ancestors = ancestors;
			this.children = forks.map((fork) => new ForkTreeNode(fork, signal));
		} catch (error) {
			if (!signal.aborted) showApiError(error, 'Failed to load fork tree');
		} finally {
			if (!signal.aborted) this.loading = false;
		}
	};

	close = (): void => {
		this.#controller.abort();
		this.isOpen = false;
	};
}
