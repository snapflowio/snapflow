/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ResourceShape } from '../../common/values/resource-shape.value';
import { parseDatabaseTimestamp } from '../../infra/database/utils/database-time.util';
import { LocationDto } from '../../location/dto/location.dto';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import type { MachineBenchmark } from '../../verification/entities/machine-benchmark.entity';
import { BenchmarkState } from '../../verification/enums/benchmark-state.enum';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import { MachineTier } from '../enums/machine-tier.enum';
import { MachineUnavailableReason } from '../enums/machine-unavailable-reason.enum';
import type { BrowseMachine } from '../utils/machine-browse.util';
import { ResourceShapeDto } from './price-floor.dto';

@ApiSchema({ name: 'MachineListing' })
export class MachineListingDto {
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty() name: string;
	@ApiProperty() hostName: string;
	@ApiProperty({ enum: MachineTier, enumName: 'MachineTier' })
	tier: MachineTier;
	@ApiProperty({ enum: MachineCategory, enumName: 'MachineCategory' })
	category: MachineCategory;
	@ApiProperty({ type: LocationDto, nullable: true })
	location: LocationDto | null;
	@ApiProperty({ type: String, nullable: true }) cpuModel: string | null;
	@ApiProperty() vcpu: number;
	@ApiProperty() memoryGiB: number;
	@ApiProperty() diskGiB: number;
	@ApiProperty({ enum: GpuType, enumName: 'GpuType', nullable: true })
	gpuType: GpuType | null;
	@ApiProperty() gpuCount: number;
	@ApiProperty() gpuMemoryGiB: number;
	@ApiProperty({ type: Number, nullable: true }) cpuScorePerVcpu: number | null;
	@ApiProperty({ type: Number, nullable: true })
	diskRandomReadIops: number | null;
	@ApiProperty({ type: Number, nullable: true })
	networkDownlinkMbps: number | null;
	@ApiProperty() reliabilityBasisPoints: number;
	@ApiProperty() uptimeBasisPoints: number;
	@ApiProperty({ description: 'All-in hourly price for the requested shape' })
	hourlyPriceMicroUsd: string;
	@ApiProperty({ description: 'All-in hourly price while stopped' })
	stoppedHourlyPriceMicroUsd: string;
	@ApiProperty({
		description:
			'All-in egress price, micro-USD per GiB; zero is free egress. Ingress is never charged',
	})
	egressMicroUsdPerGiB: string;
	@ApiProperty() available: boolean;
	@ApiProperty({
		enum: MachineUnavailableReason,
		enumName: 'MachineUnavailableReason',
		nullable: true,
	})
	unavailableReason: MachineUnavailableReason | null;
	@ApiProperty({
		type: String,
		format: 'uuid',
		nullable: true,
		description:
			'Null for machines of the requesting organization, which are unpriced',
	})
	priceCardId: string | null;

	static from(machine: BrowseMachine): MachineListingDto {
		const { row, offer } = machine;
		return {
			machineId: row.machine_id,
			name: row.name,
			hostName: row.host_name,
			tier: row.tier,
			category: row.category,
			location: LocationDto.from(row),
			cpuModel: row.cpu_model,
			vcpu: row.vcpu,
			memoryGiB: row.memory_gib,
			diskGiB: row.disk_gib,
			gpuType: row.gpu_type,
			gpuCount: row.gpu_count,
			gpuMemoryGiB: row.gpu_memory_gib,
			cpuScorePerVcpu: row.cpu_score_per_vcpu,
			diskRandomReadIops: row.disk_random_read_iops,
			networkDownlinkMbps: row.network_downlink_mbps,
			reliabilityBasisPoints: row.reliability_basis_points,
			uptimeBasisPoints: row.uptime_basis_points,
			hourlyPriceMicroUsd: offer.hourly.grossMicroUsd.toString(),
			stoppedHourlyPriceMicroUsd: offer.stopped.grossMicroUsd.toString(),
			egressMicroUsdPerGiB: offer.egressPerGiB.grossMicroUsd.toString(),
			available: machine.unavailableReason === null,
			unavailableReason: machine.unavailableReason,
			priceCardId: offer.priceCardId,
		};
	}
}

@ApiSchema({ name: 'ListingPage' })
export class ListingPageDto {
	@ApiProperty({ type: MachineListingDto, isArray: true })
	items: MachineListingDto[];
	@ApiProperty({ type: String, nullable: true }) nextCursor: string | null;
	@ApiProperty() total: number;
}

@ApiSchema({ name: 'MachineBenchmarkSummary' })
export class MachineBenchmarkSummaryDto {
	@ApiProperty({ enum: BenchmarkState, enumName: 'BenchmarkState' })
	state: BenchmarkState;
	@ApiProperty({ type: String, format: 'date-time' }) issuedAt: Date;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	completedAt: Date | null;
}

@ApiSchema({ name: 'MachinePassedBenchmark' })
export class MachinePassedBenchmarkDto {
	@ApiProperty({ type: String, format: 'date-time' }) completedAt: Date;
	@ApiProperty() suiteVersion: number;
	@ApiProperty({
		type: ResourceShapeDto,
		description: 'Inventory the benchmark measured and verified',
	})
	shape: ResourceShapeDto;

	static from(
		benchmark: Pick<
			MachineBenchmark,
			'suiteVersion' | 'cpu' | 'memoryGib' | 'diskGib' | 'gpu'
		>,
		completedAt: Date
	): MachinePassedBenchmarkDto {
		return {
			completedAt,
			suiteVersion: benchmark.suiteVersion,
			shape: { ...ResourceShape.fromColumns(benchmark) },
		};
	}
}

@ApiSchema({ name: 'MachineDetail' })
export class MachineDetailDto extends MachineListingDto {
	@ApiProperty({ type: Number, nullable: true })
	cpuSingleThreadScore: number | null;
	@ApiProperty({ type: Number, nullable: true })
	memoryBandwidthMibps: number | null;
	@ApiProperty({ type: Number, nullable: true })
	memoryLatencyNs: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'Sequential read throughput',
	})
	diskSequentialMibps: number | null;
	@ApiProperty({ type: Number, nullable: true })
	diskSequentialWriteMibps: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'p99 random read latency',
	})
	diskReadLatencyMicros: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'p99 fsync latency',
	})
	diskFsyncLatencyMicros: number | null;
	@ApiProperty({ type: Number, nullable: true })
	networkUplinkMbps: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'Lowest round-trip time to the edge',
	})
	networkMinRttMs: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'Median smoothed round-trip time under load',
	})
	networkLoadedRttMs: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'Median round-trip time variance under load',
	})
	networkJitterMs: number | null;
	@ApiProperty() gpuTflops: number;
	@ApiProperty({ type: String, format: 'date-time' }) measuredAt: Date;
	@ApiProperty({ type: MachineBenchmarkSummaryDto, nullable: true })
	latestBenchmark: MachineBenchmarkSummaryDto | null;
	@ApiProperty({
		type: [MachinePassedBenchmarkDto],
		description: 'Most recent passed benchmarks, newest first',
	})
	benchmarkHistory: MachinePassedBenchmarkDto[];
	@ApiProperty({ description: 'Host share of the hourly price' })
	hostHourlyMicroUsd: string;
	@ApiProperty({ description: 'Platform fee share of the hourly price' })
	markupHourlyMicroUsd: string;
	@ApiProperty({ description: 'Host share of the egress price per GiB' })
	hostEgressMicroUsdPerGiB: string;
	@ApiProperty({
		description: 'Platform fee share of the egress price per GiB',
	})
	markupEgressMicroUsdPerGiB: string;
	@ApiProperty() markupBasisPoints: number;

	static fromDetail(
		machine: BrowseMachine,
		latestBenchmark: MachineBenchmarkSummaryDto | null,
		benchmarkHistory: MachinePassedBenchmarkDto[]
	): MachineDetailDto {
		const { row, offer } = machine;
		return {
			...MachineListingDto.from(machine),
			cpuSingleThreadScore: row.cpu_single_thread_score,
			memoryBandwidthMibps: row.memory_bandwidth_mibps,
			memoryLatencyNs: row.memory_latency_ns,
			diskSequentialMibps: row.disk_sequential_mibps,
			diskSequentialWriteMibps: row.disk_sequential_write_mibps,
			diskReadLatencyMicros: row.disk_read_latency_micros,
			diskFsyncLatencyMicros: row.disk_fsync_latency_micros,
			networkUplinkMbps: row.network_uplink_mbps,
			networkMinRttMs: row.network_min_rtt_ms,
			networkLoadedRttMs: row.network_loaded_rtt_ms,
			networkJitterMs: row.network_jitter_ms,
			gpuTflops: row.gpu_tflops,
			measuredAt: parseDatabaseTimestamp(row.measured_at),
			latestBenchmark,
			benchmarkHistory,
			hostHourlyMicroUsd: offer.hourly.hostMicroUsd.toString(),
			markupHourlyMicroUsd: offer.hourly.markupMicroUsd.toString(),
			hostEgressMicroUsdPerGiB: offer.egressPerGiB.hostMicroUsd.toString(),
			markupEgressMicroUsdPerGiB: offer.egressPerGiB.markupMicroUsd.toString(),
			markupBasisPoints: offer.markupBasisPoints,
		};
	}
}

@ApiSchema({ name: 'MachineMarketplaceStatus' })
export class MachineMarketplaceStatusDto {
	@ApiProperty({ enum: MachineTier, enumName: 'MachineTier' })
	tier: MachineTier;
	@ApiProperty({ enum: ListingState, enumName: 'ListingState' })
	listingState: ListingState;
	@ApiProperty({ enum: ListingVisibility, enumName: 'ListingVisibility' })
	visibility: ListingVisibility;
	@ApiProperty({ type: [String] }) reasons: string[];
	@ApiProperty({
		enum: BenchmarkState,
		enumName: 'BenchmarkState',
		nullable: true,
	})
	latestBenchmarkState: BenchmarkState | null;
}
