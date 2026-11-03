/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import {
	forkSandboxMutationOptions,
	sandboxBackupMutationOptions,
	sandboxSnapshotMutationOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import {
	DEFAULT_RECOVERY_ACTION,
	NAMED_ACTION_COPY,
	type NamedRecoveryAction,
	namedRecoverySchema,
} from '#lib/features/sandboxes/lib/sandbox-recovery.ts';
import { ForkTree } from '#lib/features/sandboxes/state/fork-tree.svelte.ts';
import { RecursiveSandboxDelete } from '#lib/features/sandboxes/state/recursive-sandbox-delete.svelte.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export class SandboxRecovery {
	readonly #sandboxesHref = resolve(Path.SANDBOXES);
	readonly #detail = getSandboxDetail();

	readonly sandbox = $derived(this.#detail.sandbox);

	readonly #fork = createMutation(() =>
		forkSandboxMutationOptions(this.sandbox.id)
	);
	readonly #snapshot = createMutation(() =>
		sandboxSnapshotMutationOptions(this.sandbox.id)
	);
	readonly forkTree = new ForkTree(() => this.#detail.sandbox.id);
	readonly recursiveDelete = new RecursiveSandboxDelete(() => ({
		onDeleted: () => void goto(this.#sandboxesHref),
		sandbox: this.#detail.sandbox,
	}));
	readonly backupMutation = createMutation(() =>
		sandboxBackupMutationOptions(this.sandbox.id)
	);
	readonly form = createAppForm(() => ({
		defaultValues: { action: DEFAULT_RECOVERY_ACTION, name: '' },
		validationLogic: revalidateLogic(),
		validators: { onDynamic: namedRecoverySchema },
		onSubmit: async ({ value }) => {
			if (!this.action) return;
			const name = value.name.trim();
			const succeeded = await submitMutation(() =>
				this.action === 'fork'
					? this.#fork.mutateAsync({ name: name || undefined })
					: this.#snapshot.mutateAsync({ name })
			);
			if (succeeded) this.closeNamedAction();
		},
	}));

	action = $state<NamedRecoveryAction | null>(null);

	readonly actionCopy = $derived(
		NAMED_ACTION_COPY[this.action ?? DEFAULT_RECOVERY_ACTION]
	);
	readonly pending = $derived(this.#detail.pending);
	readonly canDelete = $derived(this.#detail.canDelete);
	readonly writeBlocked = $derived(
		this.#detail.pending || !this.#detail.canWrite
	);

	openNamedAction = (nextAction: NamedRecoveryAction): void => {
		this.form.reset({ action: nextAction, name: '' });
		this.form.setFieldValue('action', nextAction);
		this.action = nextAction;
	};

	closeNamedAction = (): void => {
		this.action = null;
		this.form.reset();
	};

	changeNamedActionOpen = (open: boolean): void => {
		if (!open) this.closeNamedAction();
	};
}
