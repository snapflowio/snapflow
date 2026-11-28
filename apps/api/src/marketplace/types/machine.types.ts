/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '../../machine/entities/machine.entity';
import type { GpuType } from '../../machine/enums/gpu-type.enum';
import type { PlacementPrice } from '../entities/placement-price.entity';

export interface MachineMeasurements {
	benchmarkId: string;
	measuredAt: Date;
	vcpu: number;
	memoryGib: number;
	diskGib: number;
	cpuSingleThreadScore: number;
	cpuScorePerVcpu: number;
	memoryBandwidthMibps: number;
	memoryLatencyNs: number;
	diskRandomReadIops: number;
	diskSequentialMibps: number;
	diskSequentialWriteMibps: number;
	diskReadLatencyMicros: number;
	diskFsyncLatencyMicros: number;
	networkDownlinkMbps: number;
	networkUplinkMbps: number;
	networkMinRttMs: number;
	networkLoadedRttMs: number;
	networkJitterMs: number;
	gpuType: GpuType | null;
	gpuCount: number;
	gpuMemoryGib: number;
	gpuTflops: number;
}

export interface MachineInventory {
	inventoryDigest: string;
	cpuModel: string;
}

type MachineOwner = Pick<Machine, 'id' | 'organizationId'>;

export type MachinePriceClassFacts = Pick<Machine, 'category' | 'gpuType'>;

interface PricedSandbox {
	id: string;
	organizationId: string;
	cpu: number;
	mem: number;
	disk: number;
	gpu: number;
	placementWholeMachine: boolean;
	placementInterruptible: boolean;
	placementKind: PlacementPrice['placementKind'];
	maxHourlyPriceMicroUsd: string | null;
}

export interface OpenPlacementPriceInput {
	sandbox: PricedSandbox;
	placement: { id: string };
	machine: MachineOwner;
}
