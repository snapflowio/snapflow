/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	Machine,
	Sandbox,
	SnapshotDto,
	VolumeDto,
} from '@snapflow/api-client';
import {
	getAllSnapshotsQueryKey,
	getBillingOverviewQueryKey,
	getMachineByIdQueryKey,
	getSandboxQueryKey,
	getSnapshotQueryKey,
	getVolumeQueryKey,
	listMachinesQueryKey,
	listSandboxesQueryKey,
	listVolumesQueryKey,
} from '@snapflow/api-client/svelte-query';
import type { QueryKey } from '@tanstack/svelte-query';

export const notificationQueryKeys = {
	sandbox: (sandbox: Sandbox): readonly QueryKey[] => [
		listSandboxesQueryKey(),
		getSandboxQueryKey({ path: { sandboxIdOrName: sandbox.id } }),
	],
	snapshot: (snapshot: SnapshotDto): readonly QueryKey[] => [
		getAllSnapshotsQueryKey(),
		getSnapshotQueryKey({ path: { id: snapshot.id } }),
	],
	volume: (volume: VolumeDto): readonly QueryKey[] => [
		listVolumesQueryKey(),
		getVolumeQueryKey({ path: { volumeId: volume.id } }),
	],
	machine: (machine: Machine): readonly QueryKey[] => [
		listMachinesQueryKey(),
		getMachineByIdQueryKey({ path: { id: machine.id } }),
	],
	billingOverview: (): readonly QueryKey[] => [getBillingOverviewQueryKey()],
};
