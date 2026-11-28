/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateMachineEnrollmentKey,
	createMachineEnrollmentKey,
	type MachineEnrollmentKey,
	revokeMachineEnrollmentKey,
} from '@snapflow/api-client';
import {
	listMachineEnrollmentKeysOptions,
	listMachineEnrollmentKeysQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

const ENROLLMENT_KEY_QUERY_KEYS = [listMachineEnrollmentKeysQueryKey()];

export function machineEnrollmentKeysQueryOptions() {
	return listMachineEnrollmentKeysOptions();
}

export function createMachineEnrollmentKeyMutationOptions() {
	return mutationOptions({
		mutationFn: async (body: CreateMachineEnrollmentKey) =>
			(await createMachineEnrollmentKey({ body })).data,
		meta: {
			invalidates: ENROLLMENT_KEY_QUERY_KEYS,
			failure: 'Failed to create the enrollment key',
		},
	});
}

export function revokeMachineEnrollmentKeyMutationOptions() {
	return mutationOptions({
		mutationFn: async (key: MachineEnrollmentKey) => {
			await revokeMachineEnrollmentKey({ path: { keyId: key.id } });
			return key;
		},
		meta: {
			invalidates: ENROLLMENT_KEY_QUERY_KEYS,
			success: 'Enrollment key revoked',
			failure: 'Failed to revoke the enrollment key',
		},
	});
}
