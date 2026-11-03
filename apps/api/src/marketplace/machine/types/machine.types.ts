/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../common/values/micro-usd.value';
import type { Machine } from '../../../sandbox/machine/entities/machine.entity';
import type { GpuType } from '../../../sandbox/machine/enums/gpu-type.enum';
import type { SandboxLease } from '../entities/sandbox-lease.entity';
import type { PriceFloorSource } from '../enums/price-floor-source.enum';

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

export type MachineOwner = Pick<Machine, 'id' | 'organizationId'>;

export type MachinePriceClassFacts = Pick<Machine, 'category' | 'gpuType'>;

export interface LeaseSandbox {
	id: string;
	organizationId: string;
	cpu: number;
	mem: number;
	disk: number;
	gpu: number;
	placementKind: SandboxLease['placementKind'];
	maxHourlyPriceMicroUsd: string | null;
	maxEgressMicroUsdPerGiB: string | null;
}

export interface OpenLeaseInput {
	sandbox: LeaseSandbox;
	placement: { id: string };
	machine: MachineOwner;
}

export interface EffectiveFloor {
	priceClass: string;
	medianMicroUsd: MicroUsd;
	floorMicroUsd: MicroUsd;
	sampleCount: number;
	source: PriceFloorSource;
}
