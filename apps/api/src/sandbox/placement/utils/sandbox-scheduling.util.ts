/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ResourceShape } from '../../../common/values/resource-shape.value';
import type { Sandbox } from '../../instance/entities/sandbox.entity';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import { machineWorkloadFingerprint } from '../../machine/utils/machine-workload-fingerprint.util';
import { placementRequest } from './sandbox-placement.util';

type SchedulableSandbox = Pick<
	Sandbox,
	| 'organizationId'
	| 'sandboxClass'
	| 'snapshot'
	| 'mode'
	| 'capabilities'
	| 'cpu'
	| 'mem'
	| 'disk'
	| 'gpu'
	| 'gpuType'
	| 'volumes'
	| 'placementKind'
	| 'pinnedMachineId'
	| 'placementCategory'
	| 'placementLocations'
	| 'placementOwnMachinesOnly'
	| 'originLatitude'
	| 'originLongitude'
	| 'placementMinimumTier'
	| 'maxHourlyPriceMicroUsd'
	| 'maxEgressMicroUsdPerGiB'
>;

export function sandboxSchedulingParameters(
	sandbox: SchedulableSandbox
): CustomerMachineParams {
	return {
		customerOrganizationId: sandbox.organizationId,
		placement: placementRequest(sandbox),
		sandboxClass: sandbox.sandboxClass,
		...ResourceShape.fromSandbox(sandbox),
		gpuType: sandbox.gpuType ?? null,
		mode: sandbox.mode,
		capabilities: sandbox.capabilities,
		volumeIds: sandbox.volumes.map(({ volumeId }) => volumeId),
		workloadFingerprint: machineWorkloadFingerprint({
			snapshot: sandbox.snapshot ?? null,
			sandboxClass: sandbox.sandboxClass,
			mode: sandbox.mode,
			capabilities: sandbox.capabilities,
			...ResourceShape.fromSandbox(sandbox),
		}),
	};
}
