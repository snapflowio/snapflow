/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../common/values/micro-usd.value';
import type {
	GeoPoint,
	LocationConstraint,
} from '../../../location/types/geo-location.types';
import type { MachineCategory } from '../../../marketplace/enums/machine-category.enum';
import type { MachineTier } from '../../../marketplace/enums/machine-tier.enum';
import type { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import type { SandboxCapability } from '../../enums/sandbox-capability.enum';
import type { SandboxClass } from '../../enums/sandbox-class.enum';
import type { SandboxMode } from '../../enums/sandbox-mode.enum';
import type { GpuType } from '../enums/gpu-type.enum';

export interface PinnedPlacement {
	kind: PlacementKind.PINNED;
	machineId: string;
}

export interface FlexiblePlacement {
	kind: PlacementKind.FLEXIBLE;
	locations: LocationConstraint[];
	ownMachinesOnly: boolean;
	origin: GeoPoint | null;
	category?: MachineCategory;
	minimumTier?: MachineTier;
	maxHourlyPriceMicroUsd?: MicroUsd;
	maxEgressMicroUsdPerGiB?: MicroUsd;
}

export type PlacementRequest = PinnedPlacement | FlexiblePlacement;

export interface WorkloadRequirements {
	mode?: SandboxMode;
	capabilities?: SandboxCapability[];
	/** Requires machines that run persistent volumes. */
	requiresVolumes?: boolean;
	/**
	 * Volumes the workload mounts. Volumes live on their home machine, so a
	 * machine qualifies only when it is the home of every homed volume.
	 */
	volumeIds?: readonly string[];
}

export interface HostGateParams {
	sandboxClass: SandboxClass;
	excludedMachineIds?: string[];
	workloadFingerprint?: string;
}

export interface GetMachineParams extends WorkloadRequirements, HostGateParams {
	customerOrganizationId: string | null;
	placement: PlacementRequest;
	snapshotRef?: string;
	snapshotRequired?: boolean;
	gpu: number;
	cpu?: number;
	memoryGiB?: number;
	diskGiB?: number;
	gpuType: GpuType | GpuType[] | null;
}

export interface CustomerMachineParams extends GetMachineParams {
	customerOrganizationId: string;
}
