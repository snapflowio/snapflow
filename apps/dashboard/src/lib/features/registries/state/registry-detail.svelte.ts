/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { DockerRegistry } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	deleteRegistryMutationOptions,
	registryQueryOptions,
	updateRegistryMutationOptions,
} from '#lib/api/registries.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import {
	type HeaderAction,
	saveDiscardActions,
} from '#lib/components/page/header-actions.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	REGISTRY_FIELDS,
	type RegistryDraft,
	type RegistryDraftErrors,
	registryDraftErrors,
	savedRegistryDraft,
	toUpdateRegistry,
} from '#lib/features/registries/lib/registry-detail.ts';
import { credentialLoadErrorMessage } from '#lib/features/secrets/lib/credential-load-error.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const REGISTRIES_HREF = resolve(Path.REGISTRIES);
const REGISTRY_NOUN = 'registry';

export class RegistryDetail {
	readonly #permission = getOrganizationPermission();
	readonly #updateMutation = createMutation(() =>
		updateRegistryMutationOptions()
	);
	readonly query;
	readonly deleteMutation = createMutation(() =>
		deleteRegistryMutationOptions()
	);
	readonly back = { label: 'Registries', href: REGISTRIES_HREF };

	edits = $state<Partial<RegistryDraft>>({});
	deleteOpen = $state(false);

	readonly canWrite = $derived(this.#permission.can({ registries: ['write'] }));
	readonly canDelete = $derived(
		this.#permission.can({ registries: ['delete'] })
	);
	readonly registry: DockerRegistry | undefined = $derived.by(
		() => this.query.data
	);
	readonly #saved: RegistryDraft | null = $derived.by(() =>
		this.registry ? savedRegistryDraft(this.registry) : null
	);
	readonly draft: RegistryDraft | null = $derived.by(() =>
		this.#saved ? { ...this.#saved, ...this.edits } : null
	);
	readonly dirty: boolean = $derived.by(() => {
		const saved = this.#saved;
		const draft = this.draft;
		return Boolean(
			saved &&
				draft &&
				REGISTRY_FIELDS.some(
					({ key }) => draft[key].trim() !== saved[key].trim()
				)
		);
	});
	readonly #errors: RegistryDraftErrors = $derived.by(() =>
		this.draft ? registryDraftErrors(this.draft) : {}
	);
	readonly visibleErrors: RegistryDraftErrors = $derived.by(() =>
		Object.fromEntries(
			Object.entries(this.#errors).filter(([key]) =>
				Object.hasOwn(this.edits, key)
			)
		)
	);
	readonly loadErrorMessage: string = $derived.by(() =>
		credentialLoadErrorMessage(this.query.error, REGISTRY_NOUN)
	);
	readonly deleteTarget: DockerRegistry | null = $derived.by(() =>
		this.deleteOpen ? (this.registry ?? null) : null
	);
	readonly actions: HeaderAction[] = $derived.by(() =>
		this.registry
			? [
					{
						id: 'delete',
						kind: 'delete',
						label: 'Delete',
						onSelect: () => {
							this.deleteOpen = true;
						},
						visible: this.canDelete,
					},
					...(this.canWrite
						? saveDiscardActions({
								dirty: this.dirty,
								saving: this.#updateMutation.isPending,
								onSave: () => void this.save(),
								onDiscard: this.discard,
							})
						: []),
				]
			: []
	);

	constructor(registryId: () => string) {
		this.query = createQuery(() => registryQueryOptions(registryId()));
	}

	edit = (key: keyof RegistryDraft, value: string): void => {
		this.edits = { ...this.edits, [key]: value };
	};

	discard = (): void => {
		this.edits = {};
	};

	cancelDelete = (): void => {
		this.deleteOpen = false;
	};

	save = async (): Promise<void> => {
		const registry = this.registry;
		const draft = this.draft;
		if (!(registry && draft && this.dirty)) return;
		if (Object.keys(this.#errors).length > 0) {
			this.edits = { ...draft };
			return;
		}
		const updated = await submitMutation(() =>
			this.#updateMutation.mutateAsync({
				path: { id: registry.id },
				body: toUpdateRegistry(draft),
			})
		);
		if (!updated) return;
		this.edits = {};
		await this.query.refetch();
	};

	remove = (registry: DockerRegistry): void => {
		this.deleteMutation.mutate(registry, {
			onSuccess: (deleted) => {
				this.deleteOpen = false;
				this.discard();
				toast.success(`Deleted ${deleted.name}`);
				void goto(REGISTRIES_HREF);
			},
		});
	};
}
