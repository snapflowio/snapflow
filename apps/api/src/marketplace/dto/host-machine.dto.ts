/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import { LocationDto } from '../../location/dto/location.dto';
import type { Machine } from '../../sandbox/machine/entities/machine.entity';
import { GpuType } from '../../sandbox/machine/enums/gpu-type.enum';
import { BenchmarkState } from '../../verification/enums/benchmark-state.enum';
import type { MachineListing } from '../entities/machine-listing.entity';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import { MachineTier } from '../enums/machine-tier.enum';
import { PriceCardDto } from './price-card.dto';

@ApiSchema({ name: 'HostMachineListing' })
export class HostMachineListingDto {
	@ApiProperty({ enum: ListingState, enumName: 'ListingState' })
	state: ListingState;
	@ApiProperty({ enum: ListingVisibility, enumName: 'ListingVisibility' })
	visibility: ListingVisibility;
	@ApiProperty({ description: 'Send as If-Match to change the listing' })
	version: number;
	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	currentPriceCardId: string | null;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	belowFloorSince: Date | null;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	aboveEgressCeilingSince: Date | null;
	@ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;

	static from(listing: MachineListing): HostMachineListingDto {
		return {
			state: listing.state,
			visibility: listing.visibility,
			version: listing.version,
			currentPriceCardId: listing.currentPriceCardId,
			belowFloorSince: listing.belowFloorSince,
			aboveEgressCeilingSince: listing.aboveEgressCeilingSince,
			updatedAt: listing.updatedAt,
		};
	}
}

export interface HostMachineParts {
	machine: Machine;
	listing: MachineListing;
	currentPriceCard: PriceCardDto | null;
	latestBenchmarkState: BenchmarkState | null;
}

@ApiSchema({ name: 'HostMachine' })
export class HostMachineDto {
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty() name: string;
	@ApiProperty({ type: LocationDto, nullable: true })
	location: LocationDto | null;
	@ApiProperty({ enum: MachineTier, enumName: 'MachineTier' })
	tier: MachineTier;
	@ApiProperty({ type: [String] }) tierReasons: string[];
	@ApiProperty({
		enum: MachineCategory,
		enumName: 'MachineCategory',
		nullable: true,
	})
	category: MachineCategory | null;
	@ApiProperty({ type: String, nullable: true }) cpuModel: string | null;
	@ApiProperty({ type: Number, nullable: true }) vcpu: number | null;
	@ApiProperty({ type: Number, nullable: true }) memoryGiB: number | null;
	@ApiProperty({ type: Number, nullable: true }) diskGiB: number | null;
	@ApiProperty({ enum: GpuType, enumName: 'GpuType', nullable: true })
	gpuType: GpuType | null;
	@ApiProperty() gpuCount: number;
	@ApiProperty() gpuMemoryGiB: number;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	measuredAt: Date | null;
	@ApiProperty({
		enum: BenchmarkState,
		enumName: 'BenchmarkState',
		nullable: true,
	})
	latestBenchmarkState: BenchmarkState | null;
	@ApiProperty() fingerprintConflict: boolean;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	listedSince: Date | null;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	restrictedAt: Date | null;
	@ApiProperty({ type: String, nullable: true })
	restrictionReason: string | null;
	@ApiProperty({ type: HostMachineListingDto })
	listing: HostMachineListingDto;
	@ApiProperty({ type: PriceCardDto, nullable: true })
	currentPriceCard: PriceCardDto | null;

	static from(parts: HostMachineParts): HostMachineDto {
		const { machine } = parts;
		return {
			machineId: machine.id,
			name: machine.name,
			location: LocationDto.from(machine),
			tier: machine.tier,
			tierReasons: machine.tierReasons,
			category: machine.category,
			cpuModel: machine.cpuModel,
			vcpu: machine.measuredVcpu,
			memoryGiB: machine.measuredMemoryGib,
			diskGiB: machine.measuredDiskGib,
			gpuType: machine.gpuType,
			gpuCount: machine.gpuCount,
			gpuMemoryGiB: machine.gpuMemoryGib,
			measuredAt: machine.measuredAt,
			latestBenchmarkState: parts.latestBenchmarkState,
			fingerprintConflict: machine.fingerprintConflict,
			listedSince: machine.listedSince,
			restrictedAt: machine.restrictedAt,
			restrictionReason: machine.restrictionReason,
			listing: HostMachineListingDto.from(parts.listing),
			currentPriceCard: parts.currentPriceCard,
		};
	}
}

@ApiSchema({ name: 'HostMachinePage' })
export class HostMachinePageDto extends CursorPageDto<HostMachineDto> {
	@ApiProperty({ type: HostMachineDto, isArray: true })
	declare items: HostMachineDto[];
}

@ApiSchema({ name: 'UpdateMachineListing' })
export class UpdateMachineListingDto {
	@ApiProperty({ enum: ListingState, enumName: 'ListingState' })
	@IsEnum(ListingState)
	state: ListingState;

	@ApiProperty({ enum: ListingVisibility, enumName: 'ListingVisibility' })
	@IsEnum(ListingVisibility)
	visibility: ListingVisibility;
}
