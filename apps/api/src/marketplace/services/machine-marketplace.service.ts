/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineBenchmark } from '../../verification/entities/machine-benchmark.entity';
import { MachineMarketplaceStatusDto } from '../dto/machine.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import type { MachineTier } from '../enums/machine-tier.enum';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import type {
	MachineInventory,
	MachineMeasurements,
} from '../types/machine.types';
import { machineCategory } from '../utils/machine-category.util';

@Injectable()
export class MachineMarketplaceService {
	constructor(private readonly entityManager: EntityManager) {}

	async findOwned(
		manager: EntityManager,
		organizationId: string,
		machineId: string,
		lockMode?: LockMode
	): Promise<Machine> {
		const machine = await manager.findOne(
			Machine,
			{ id: machineId, organizationId },
			lockMode === undefined ? {} : { lockMode }
		);
		if (!machine) {
			throw new NotFoundException({
				code: MarketplaceErrorCode.MACHINE_NOT_FOUND,
				message: 'Machine not found',
			});
		}
		return machine;
	}

	async ensureListing(
		manager: EntityManager,
		machineId: string
	): Promise<void> {
		const existing = await manager.findOne(MachineListing, { machineId });
		if (existing) return;
		const listing = new MachineListing();
		listing.machineId = machineId;
		manager.persist(listing);
		await manager.flush();
	}

	async recordInventoryDigest(
		manager: EntityManager,
		machineId: string,
		digest: string
	): Promise<boolean> {
		const changed = await manager.nativeUpdate(
			Machine,
			{
				id: machineId,
				$or: [{ inventoryDigest: null }, { inventoryDigest: { $ne: digest } }],
			},
			{ inventoryDigest: digest }
		);
		return changed > 0;
	}

	async status(machineId: string): Promise<MachineMarketplaceStatusDto> {
		const [machine, listing, benchmark] = await Promise.all([
			this.entityManager.findOneOrFail(Machine, { id: machineId }),
			this.entityManager.findOneOrFail(MachineListing, { machineId }),
			this.entityManager.findOne(
				MachineBenchmark,
				{ machineId },
				{ orderBy: { issuedAt: QueryOrder.DESC } }
			),
		]);
		return {
			tier: machine.tier,
			listingState: listing.state,
			visibility: listing.visibility,
			reasons: machine.restrictionReason
				? [...machine.tierReasons, machine.restrictionReason]
				: machine.tierReasons,
			latestBenchmarkState: benchmark?.state ?? null,
		};
	}

	async applyMeasurements(
		manager: EntityManager,
		machineId: string,
		measurements: MachineMeasurements,
		inventory: MachineInventory
	): Promise<Machine> {
		const machine = await this.lock(manager, machineId);
		machine.category = machineCategory({
			vcpu: measurements.vcpu,
			memoryGib: measurements.memoryGib,
			gpuCount: measurements.gpuCount,
		});
		machine.cpuModel = inventory.cpuModel;
		machine.measuredVcpu = measurements.vcpu;
		machine.measuredMemoryGib = measurements.memoryGib;
		machine.measuredDiskGib = measurements.diskGib;
		machine.cpuSingleThreadScore = measurements.cpuSingleThreadScore;
		machine.cpuScorePerVcpu = measurements.cpuScorePerVcpu;
		machine.memoryBandwidthMibps = measurements.memoryBandwidthMibps;
		machine.memoryLatencyNs = measurements.memoryLatencyNs;
		machine.diskRandomReadIops = measurements.diskRandomReadIops;
		machine.diskSequentialMibps = measurements.diskSequentialMibps;
		machine.diskSequentialWriteMibps = measurements.diskSequentialWriteMibps;
		machine.diskReadLatencyMicros = measurements.diskReadLatencyMicros;
		machine.diskFsyncLatencyMicros = measurements.diskFsyncLatencyMicros;
		machine.networkDownlinkMbps = measurements.networkDownlinkMbps;
		machine.networkUplinkMbps = measurements.networkUplinkMbps;
		machine.networkMinRttMs = measurements.networkMinRttMs;
		machine.networkLoadedRttMs = measurements.networkLoadedRttMs;
		machine.networkJitterMs = measurements.networkJitterMs;
		machine.gpuType = measurements.gpuType;
		machine.gpuCount = measurements.gpuCount;
		machine.gpuMemoryGib = measurements.gpuMemoryGib;
		machine.gpuTflops = measurements.gpuTflops;
		machine.measuredAt = measurements.measuredAt;
		machine.latestBenchmarkId = measurements.benchmarkId;
		machine.benchmarkedInventoryDigest = inventory.inventoryDigest;
		await manager.flush();
		return machine;
	}

	async setTier(
		manager: EntityManager,
		machineId: string,
		tier: MachineTier,
		reasons: string[]
	): Promise<Machine> {
		const machine = await this.lock(manager, machineId);
		if (machine.tier !== tier) {
			machine.tier = tier;
			machine.tierChangedAt = await databaseNow(manager);
		}
		machine.tierReasons = reasons;
		await manager.flush();
		return machine;
	}

	async restrict(
		manager: EntityManager,
		machineId: string,
		reason: string
	): Promise<Machine> {
		const machine = await this.lock(manager, machineId);
		machine.restrictedAt ??= await databaseNow(manager);
		machine.restrictionReason = reason;
		await manager.flush();
		return machine;
	}

	private lock(manager: EntityManager, machineId: string): Promise<Machine> {
		return manager.findOneOrFail(
			Machine,
			{ id: machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
	}
}
