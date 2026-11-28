/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	hostProfileQueryOptions,
	updateHostProfileMutationOptions,
} from '#lib/api/host-profile.ts';
import {
	type HeaderAction,
	saveDiscardActions,
} from '#lib/components/page/header-actions.ts';
import {
	type HostProfileValues,
	hostProfileErrors,
	hostProfileValues,
	toUpdateHostProfile,
} from '#lib/features/listings/lib/host-profile.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const NO_VALUES: HostProfileValues = { displayName: '', description: '' };

export class HostProfileEditor {
	readonly #permission = getOrganizationPermission();
	readonly query = createQuery(() => hostProfileQueryOptions());
	readonly #update = createMutation(() => updateHostProfileMutationOptions());

	edits = $state<Partial<HostProfileValues>>({});
	#validated = $state(false);

	readonly canWrite = $derived(this.#permission.can({ listings: ['write'] }));
	readonly saving = $derived(this.#update.isPending);
	readonly #saved = $derived(
		this.query.data ? hostProfileValues(this.query.data) : NO_VALUES
	);
	readonly values: HostProfileValues = $derived({
		...this.#saved,
		...this.edits,
	});
	readonly dirty = $derived(
		this.values.displayName.trim() !== this.#saved.displayName ||
			this.values.description.trim() !== this.#saved.description
	);
	readonly #errors = $derived(hostProfileErrors(this.values));
	readonly errors = $derived(this.#validated ? this.#errors : {});
	readonly actions: HeaderAction[] = $derived(
		this.canWrite
			? saveDiscardActions({
					dirty: this.dirty,
					saving: this.saving,
					onSave: () => this.save(),
					onDiscard: () => this.discard(),
				}).map((action) =>
					action.kind === 'primary'
						? { ...action, visible: this.dirty || this.saving }
						: action
				)
			: []
	);

	edit = (key: keyof HostProfileValues, value: string): void => {
		this.edits = { ...this.edits, [key]: value };
	};

	discard = (): void => {
		this.edits = {};
		this.#validated = false;
	};

	save = (): void => {
		this.#validated = true;
		if (!this.dirty || this.saving) return;
		if (this.#errors.displayName || this.#errors.description) return;
		this.#update.mutate(toUpdateHostProfile(this.values), {
			onSuccess: this.discard,
		});
	};
}
