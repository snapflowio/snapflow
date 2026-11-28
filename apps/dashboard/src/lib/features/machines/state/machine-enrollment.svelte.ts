/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	CreatedMachineEnrollmentKey,
	MachineEnrollmentKey,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { requestBenchmarkMutationOptions } from '#lib/api/listings.ts';
import {
	createMachineEnrollmentKeyMutationOptions,
	machineEnrollmentKeysQueryOptions,
	revokeMachineEnrollmentKeyMutationOptions,
} from '#lib/api/machines/enrollment-keys.ts';
import { enrolledMachinesQueryOptions } from '#lib/api/machines/machines.ts';
import {
	DEFAULT_FLEET_LIFETIME,
	defaultEnrollmentKeyName,
	ENROLLMENT_KEY_NAME_MAX_LENGTH,
	EnrollmentKeyKind,
	type FleetLifetime,
} from '#lib/features/machines/lib/enrollment-key.ts';
import {
	enrollmentFailure,
	enrollmentFailureActions,
	enrollmentSteps,
	newestEnrollmentKey,
} from '#lib/features/machines/lib/enrollment-progress.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Clock } from '#lib/utils/clock.svelte.ts';

const ENROLLMENT_REFRESH_MILLISECONDS = 5_000;
const CLOCK_TICK_MILLISECONDS = 60_000;
const NAME_TOO_LONG_MESSAGE = `Use at most ${ENROLLMENT_KEY_NAME_MAX_LENGTH} characters.`;

export class MachineEnrollment {
	readonly #permission = getOrganizationPermission();
	readonly #clock = new Clock(CLOCK_TICK_MILLISECONDS);

	name = $state('');
	kind = $state<EnrollmentKeyKind>(EnrollmentKeyKind.Single);
	fleetLifetime = $state<FleetLifetime>(DEFAULT_FLEET_LIFETIME);
	created = $state.raw<CreatedMachineEnrollmentKey | null>(null);
	revoking = $state.raw<MachineEnrollmentKey | null>(null);
	watchedKeyId = $state<string | null>(null);
	managing = $state(false);

	readonly canWrite = $derived(
		this.#permission.can({ machines: ['write'], apiKey: ['create'] })
	);
	readonly keys = createQuery(() => ({
		...machineEnrollmentKeysQueryOptions(),
		enabled: this.canWrite,
		refetchInterval: ENROLLMENT_REFRESH_MILLISECONDS,
	}));
	readonly create = createMutation(() =>
		createMachineEnrollmentKeyMutationOptions()
	);
	readonly revoke = createMutation(() =>
		revokeMachineEnrollmentKeyMutationOptions()
	);

	readonly now = $derived(this.#clock.now);
	readonly watchedKey = $derived.by(() => {
		const keys = this.keys.data?.items ?? [];
		return (
			keys.find((key) => key.id === this.watchedKeyId) ??
			newestEnrollmentKey(keys) ??
			null
		);
	});
	readonly #machines = createQuery(() => ({
		...enrolledMachinesQueryOptions(this.watchedKey?.id ?? ''),
		enabled: this.watchedKey !== null,
		refetchInterval: ENROLLMENT_REFRESH_MILLISECONDS,
	}));
	readonly machinesLoading = $derived(
		this.watchedKey !== null && this.#machines.isPending
	);
	readonly progress = $derived(
		(this.#machines.data ?? []).map((machine) => ({
			machine,
			steps: enrollmentSteps(machine.enrollmentPhase),
			failure: enrollmentFailure(machine),
			failureActions: enrollmentFailureActions(machine),
		}))
	);
	readonly canRequestBenchmark = $derived(
		this.#permission.can({ listings: ['write'] })
	);
	readonly requestBenchmark = createMutation(() =>
		requestBenchmarkMutationOptions()
	);

	readonly #trimmedName = $derived(this.name.trim());
	readonly nameError = $derived(
		this.#trimmedName.length > ENROLLMENT_KEY_NAME_MAX_LENGTH
			? NAME_TOO_LONG_MESSAGE
			: null
	);
	readonly ready = $derived(
		this.canWrite &&
			this.#trimmedName !== '' &&
			this.nameError === null &&
			!this.create.isPending
	);

	createDefault = (): void => {
		if (!this.canWrite || this.created || this.create.isPending) return;
		this.#createKey(defaultEnrollmentKeyName(new Date()), true, undefined);
	};

	submit = (onCreated?: () => void): void => {
		if (!this.ready) return;
		const singleUse = this.kind === EnrollmentKeyKind.Single;
		this.#createKey(
			this.#trimmedName,
			singleUse,
			singleUse ? undefined : Number(this.fleetLifetime),
			() => {
				this.name = '';
				onCreated?.();
			}
		);
	};

	#createKey(
		name: string,
		singleUse: boolean,
		expiresIn: number | undefined,
		onCreated?: () => void
	): void {
		this.create.mutate(
			{
				name,
				singleUse,
				expiresIn,
			},
			{
				onSuccess: (created) => {
					this.created = created;
					this.watchedKeyId = created.id;
					onCreated?.();
				},
			}
		);
	}

	watch = (key: MachineEnrollmentKey): void => {
		this.watchedKeyId = key.id;
	};

	confirmRevoke = (key: MachineEnrollmentKey): void => {
		this.revoke.mutate(key, {
			onSuccess: () => {
				this.revoking = null;
			},
		});
	};
}
