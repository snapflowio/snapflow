/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { lockRowsForNoKeyUpdate } from '../../infra/database/utils/row-lock.util';
import { lockMachinesForUpdate } from '../../machine/utils/machine-lock.util';
import { ACTIVE_BACKEND_STATES } from '../constants/exposure.constants';
import { Edge } from '../entities/edge.entity';
import { Exposure } from '../entities/exposure.entity';
import { ExposureBackend } from '../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../entities/machine-edge-binding.entity';

export interface NetworkLockScope {
	machineIds: Iterable<string>;
	edgeIds: Iterable<string>;
}

export function lockExposures(
	manager: EntityManager,
	exposureIds: Iterable<string>,
	where?: FilterQuery<Exposure>
): Promise<Exposure[]> {
	return lockRowsForNoKeyUpdate(manager, Exposure, exposureIds, where);
}

export async function lockExposuresWhere(
	manager: EntityManager,
	where: FilterQuery<Exposure>
): Promise<Exposure[]> {
	const planned = await manager.find(Exposure, where, {
		fields: ['id'],
		disableIdentityMap: true,
	});
	return lockExposures(
		manager,
		planned.map(({ id }) => id),
		where
	);
}

export function lockEdges(
	manager: EntityManager,
	edgeIds: Iterable<string>,
	where?: FilterQuery<Edge>
): Promise<Edge[]> {
	return lockRowsForNoKeyUpdate(manager, Edge, edgeIds, where);
}

export function lockBindings(
	manager: EntityManager,
	bindingIds: Iterable<string>,
	where?: FilterQuery<MachineEdgeBinding>
): Promise<MachineEdgeBinding[]> {
	return lockRowsForNoKeyUpdate(manager, MachineEdgeBinding, bindingIds, where);
}

export function lockBackends(
	manager: EntityManager,
	backendIds: Iterable<string>,
	where?: FilterQuery<ExposureBackend>
): Promise<ExposureBackend[]> {
	return lockRowsForNoKeyUpdate(manager, ExposureBackend, backendIds, where);
}

export async function lockNetworkScope(
	manager: EntityManager,
	scope: NetworkLockScope
) {
	const machines = await lockMachinesForUpdate(manager, scope.machineIds);
	return { machines, edges: await lockEdges(manager, scope.edgeIds) };
}

export function networkScopeOf(
	rows: readonly Pick<ExposureBackend, 'machineId' | 'edgeId'>[]
): NetworkLockScope {
	return {
		machineIds: rows.map((row) => row.machineId),
		edgeIds: rows.map((row) => row.edgeId),
	};
}

export function findLiveBackends(
	manager: EntityManager,
	exposureIds: readonly string[]
): Promise<ExposureBackend[]> {
	return manager.find(
		ExposureBackend,
		{
			exposureId: { $in: [...exposureIds] },
			state: { $in: [...ACTIVE_BACKEND_STATES] },
		},
		{ orderBy: { createdAt: 'ASC', id: 'ASC' } }
	);
}

export async function lockLiveBackends(
	manager: EntityManager,
	backends: readonly ExposureBackend[]
): Promise<ExposureBackend[]> {
	const locked = await lockBackends(
		manager,
		backends.map((backend) => backend.id),
		{ state: { $in: [...ACTIVE_BACKEND_STATES] } }
	);
	const lockedIds = new Set(locked.map((backend) => backend.id));
	return backends.filter((backend) => lockedIds.has(backend.id));
}

export async function lockExposureNetwork(
	manager: EntityManager,
	exposureIds: Iterable<string>,
	where?: FilterQuery<Exposure>
) {
	const exposures = await lockExposures(manager, exposureIds, where);
	const liveBackends = await findLiveBackends(
		manager,
		exposures.map((exposure) => exposure.id)
	);
	const { edges } = await lockNetworkScope(
		manager,
		networkScopeOf(liveBackends)
	);
	await lockBindings(
		manager,
		liveBackends.map((backend) => backend.bindingId)
	);
	return {
		exposures,
		edges,
		backends: await lockLiveBackends(manager, liveBackends),
	};
}
