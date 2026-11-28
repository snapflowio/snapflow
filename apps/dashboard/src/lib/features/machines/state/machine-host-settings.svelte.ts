/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createMutation } from '@tanstack/svelte-query';
import { setMachineHostSettingsMutationOptions } from '#lib/api/machines/machines.ts';
import {
	HOST_SETTINGS_FIELDS,
	type HostSettingsDraft,
	hostSettingsDraft,
	hostSettingsErrors,
	toHostSettings,
} from '#lib/features/machines/lib/host-settings.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';

export class MachineHostSettingsEditor {
	readonly #detail = getMachineDetail();
	readonly #save = createMutation(() =>
		setMachineHostSettingsMutationOptions(this.#detail.machine.id)
	);

	edits = $state<Partial<HostSettingsDraft>>({});

	readonly canWrite = $derived(this.#detail.canWrite);
	readonly saving = $derived(this.#save.isPending);
	readonly #saved = $derived(
		hostSettingsDraft(this.#detail.machine.hostSettings)
	);
	readonly draft: HostSettingsDraft = $derived({
		...this.#saved,
		...this.edits,
	});
	readonly dirty = $derived(
		HOST_SETTINGS_FIELDS.some((key) => this.draft[key] !== this.#saved[key])
	);
	readonly errors = $derived(hostSettingsErrors(this.draft));
	readonly ready = $derived(
		this.canWrite &&
			this.dirty &&
			!this.saving &&
			Object.keys(this.errors).length === 0
	);

	edit = <Key extends keyof HostSettingsDraft>(
		key: Key,
		value: HostSettingsDraft[Key]
	): void => {
		this.edits = { ...this.edits, [key]: value };
	};

	discard = (): void => {
		this.edits = {};
	};

	save = (): void => {
		if (!this.ready) return;
		this.#save.mutate(toHostSettings(this.draft), {
			onSuccess: async () => {
				await this.#detail.refresh();
				this.discard();
			},
		});
	};
}
