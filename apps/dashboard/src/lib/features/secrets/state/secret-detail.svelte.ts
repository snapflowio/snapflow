/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SecretDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	deleteSecretMutationOptions,
	rotateSecretMutationOptions,
	secretQueryOptions,
	updateSecretMutationOptions,
} from '#lib/api/secrets.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import {
	type HeaderAction,
	saveDiscardActions,
} from '#lib/components/page/header-actions.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { credentialLoadErrorMessage } from '#lib/features/secrets/lib/credential-load-error.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const SECRETS_HREF = resolve(Path.SECRETS);
const SECRET_NOUN = 'secret';

export class SecretDetail {
	readonly #permission = getOrganizationPermission();
	readonly #updateMutation;
	readonly #rotateMutation = createMutation(() =>
		rotateSecretMutationOptions()
	);
	readonly query;
	readonly deleteMutation = createMutation(() => deleteSecretMutationOptions());
	readonly back = { label: 'Secrets', href: SECRETS_HREF };

	nameDraft = $state<string | null>(null);
	descriptionDraft = $state<string | null>(null);
	valueDraft = $state('');
	#saving = $state(false);
	deleteOpen = $state(false);

	readonly canWrite = $derived(this.#permission.can({ secrets: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ secrets: ['delete'] }));
	readonly secret: SecretDto | undefined = $derived.by(() => this.query.data);
	readonly #savedDescription: string = $derived.by(
		() => this.secret?.description ?? ''
	);
	readonly name: string = $derived.by(
		() => this.nameDraft ?? this.secret?.name ?? ''
	);
	readonly description: string = $derived.by(
		() => this.descriptionDraft ?? this.#savedDescription
	);
	readonly #nameChanged: boolean = $derived.by(
		() => this.secret !== undefined && this.name.trim() !== this.secret.name
	);
	readonly #descriptionChanged: boolean = $derived.by(
		() =>
			this.secret !== undefined &&
			this.description.trim() !== this.#savedDescription
	);
	readonly dirty: boolean = $derived.by(
		() =>
			this.#nameChanged ||
			this.#descriptionChanged ||
			this.valueDraft.length > 0
	);
	readonly nameError: string | undefined = $derived.by(() =>
		this.nameDraft !== null && !this.name.trim()
			? 'Name is required'
			: undefined
	);
	readonly loadErrorMessage: string = $derived.by(() =>
		credentialLoadErrorMessage(this.query.error, SECRET_NOUN)
	);
	readonly deleteTarget: SecretDto | null = $derived.by(() =>
		this.deleteOpen ? (this.secret ?? null) : null
	);
	readonly actions: HeaderAction[] = $derived.by(() =>
		this.secret
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
								saving: this.#saving,
								onSave: () => void this.save(),
								onDiscard: this.discard,
							})
						: []),
				]
			: []
	);

	constructor(secretId: () => string) {
		this.query = createQuery(() => secretQueryOptions(secretId()));
		this.#updateMutation = createMutation(() =>
			updateSecretMutationOptions(secretId())
		);
	}

	discard = (): void => {
		this.nameDraft = null;
		this.descriptionDraft = null;
		this.valueDraft = '';
	};

	cancelDelete = (): void => {
		this.deleteOpen = false;
	};

	save = async (): Promise<void> => {
		const secret = this.secret;
		if (!(secret && this.dirty) || this.nameError || this.#saving) return;
		this.#saving = true;
		const metadataSaved =
			!(this.#nameChanged || this.#descriptionChanged) ||
			(await submitMutation(() =>
				this.#updateMutation.mutateAsync({
					name: this.name.trim(),
					description: this.description.trim(),
				})
			));
		if (metadataSaved) {
			this.nameDraft = null;
			this.descriptionDraft = null;
		}
		const valueSaved =
			metadataSaved &&
			(this.valueDraft.length === 0 ||
				(await submitMutation(() =>
					this.#rotateMutation.mutateAsync({
						secret,
						value: this.valueDraft,
					})
				)));
		if (valueSaved) this.valueDraft = '';
		if (metadataSaved) await this.query.refetch();
		this.#saving = false;
	};

	remove = (secret: SecretDto): void => {
		this.deleteMutation.mutate(secret, {
			onSuccess: () => {
				this.deleteOpen = false;
				this.discard();
				void goto(SECRETS_HREF);
			},
		});
	};
}
