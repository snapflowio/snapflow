/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ExposureBackend } from '../../entities/exposure-backend.entity';
import type { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';

export function routeSnapshotAcknowledgementIsCurrent(
	desiredRouteTableVersion: string,
	reportedRouteTableVersion: string
): boolean {
	return desiredRouteTableVersion === reportedRouteTableVersion;
}

export function bindingAcknowledgementIsCurrent(
	binding: Pick<
		MachineEdgeBinding,
		'activeConnectionId' | 'replacementConnectionId'
	> | null,
	connectionId: string
): binding is Pick<
	MachineEdgeBinding,
	'activeConnectionId' | 'replacementConnectionId'
> {
	return (
		binding !== null &&
		(binding.activeConnectionId === connectionId ||
			binding.replacementConnectionId === connectionId)
	);
}

export function listenerObservationIsCurrent(
	backend: Pick<ExposureBackend, 'routeTableVersion'> | null,
	routeTableVersion: string
): backend is Pick<ExposureBackend, 'routeTableVersion'> {
	return backend?.routeTableVersion === routeTableVersion;
}
