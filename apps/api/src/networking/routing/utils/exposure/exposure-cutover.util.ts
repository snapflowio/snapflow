/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EXPOSURE_BACKEND_STATE } from '../../constants/exposure.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type { ExposureBackend } from '../../entities/exposure-backend.entity';

type CutoverBackend = Pick<
	ExposureBackend,
	| 'id'
	| 'exposureId'
	| 'protocol'
	| 'state'
	| 'machineId'
	| 'assignmentGeneration'
	| 'cutoverStartedAt'
	| 'cutoverVerifiedAt'
>;

export function exposureCutoverPredecessor<T extends CutoverBackend>(
	candidate: T,
	backends: readonly T[]
): T | null {
	return (
		backends.find(
			(backend) =>
				backend.id !== candidate.id &&
				backend.exposureId === candidate.exposureId &&
				backend.state === EXPOSURE_BACKEND_STATE.ACTIVE &&
				backend.machineId === candidate.machineId &&
				backend.assignmentGeneration === candidate.assignmentGeneration
		) ?? null
	);
}

export function requiresExposureCutover(
	candidate: CutoverBackend,
	backends: readonly CutoverBackend[]
): boolean {
	return (
		candidate.protocol === NETWORK_PROTOCOL.HTTP &&
		exposureCutoverPredecessor(candidate, backends) !== null
	);
}

export function exposureCutoverAllowsActivation(
	candidate: CutoverBackend,
	backends: readonly CutoverBackend[]
): boolean {
	if (candidate.protocol !== NETWORK_PROTOCOL.HTTP) return true;
	if (candidate.cutoverStartedAt && !candidate.cutoverVerifiedAt) return false;
	return (
		!requiresExposureCutover(candidate, backends) ||
		Boolean(candidate.cutoverVerifiedAt)
	);
}
