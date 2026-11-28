/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { watch } from 'runed';
import { updateProfileName } from '#lib/api/auth/account.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';

export const PROFILE_NAME_MAX_LENGTH = 100;

const NAME_REQUIRED_MESSAGE = 'Name is required';
const UPDATE_FAILED_MESSAGE = 'Failed to update profile';

export class ProfileNameDraft {
	readonly #auth = getAuth();
	name = $state('');
	saving = $state(false);
	#validated = $state(false);
	readonly #initial = $derived(this.#auth.user?.name ?? '');

	readonly dirty = $derived(this.name.trim() !== this.#initial);
	readonly error = $derived(
		this.#validated && !this.name.trim() ? NAME_REQUIRED_MESSAGE : null
	);

	constructor() {
		watch(
			() => this.#initial,
			(initial) => {
				this.name = initial;
				this.#validated = false;
			}
		);
	}

	discard = (): void => {
		this.name = this.#initial;
		this.#validated = false;
	};

	save = async (): Promise<void> => {
		if (this.saving || !this.dirty) return;
		this.#validated = true;
		const name = this.name.trim();
		if (!name) return;
		this.saving = true;
		try {
			const result = await updateProfileName(name);
			if (result.error) {
				showApiError(result.error, UPDATE_FAILED_MESSAGE);
				return;
			}
			await this.#auth.refetch();
		} finally {
			this.saving = false;
		}
	};
}
