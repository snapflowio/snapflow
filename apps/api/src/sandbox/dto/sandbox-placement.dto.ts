/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsOptional,
	IsUUID,
	Matches,
	ValidateIf,
} from 'class-validator';
import { MICRO_USD_PATTERN } from '../../common/constants/money.constants';
import { PLACEMENT_LOCATION_LIMIT } from '../../location/constants/location.constants';
import { IsLocationCode } from '../../location/validators/is-location-code.validator';
import { MachineCategory } from '../../marketplace/enums/machine-category.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { WhenMachineUnavailable } from '../enums/when-machine-unavailable.enum';

const isPinned = (placement: SandboxPlacementRequestDto) =>
	placement.kind === PlacementKind.PINNED;

const isFlexible = (placement: SandboxPlacementRequestDto) =>
	placement.kind === PlacementKind.FLEXIBLE;

const takesMaximumPrice = (placement: SandboxPlacementRequestDto) =>
	isFlexible(placement) || placement.wholeMachine === true;

@ApiSchema({ name: 'SandboxPlacementRequest' })
export class SandboxPlacementRequestDto {
	@ApiProperty({ enum: PlacementKind, enumName: 'PlacementKind' })
	@IsEnum(PlacementKind)
	kind: PlacementKind;

	@ApiPropertyOptional({
		format: 'uuid',
		description: 'Machine to pin the sandbox to; required for pinned placement',
	})
	@ValidateIf(isPinned)
	@IsUUID()
	machineId?: string;

	@ApiPropertyOptional({
		format: 'uuid',
		description:
			'Price card the caller accepted; a different current card fails with price_changed',
	})
	@ValidateIf(
		(placement: SandboxPlacementRequestDto) =>
			isPinned(placement) && placement.expectedPriceCardId !== undefined
	)
	@IsUUID()
	expectedPriceCardId?: string;

	@ApiPropertyOptional({ enum: MachineCategory, enumName: 'MachineCategory' })
	@ValidateIf(
		(placement: SandboxPlacementRequestDto) =>
			isFlexible(placement) && placement.category !== undefined
	)
	@IsEnum(MachineCategory)
	category?: MachineCategory;

	@ApiPropertyOptional({
		type: [String],
		maxItems: PLACEMENT_LOCATION_LIMIT,
		example: ['DE', 'europe'],
		description:
			'Continents (e.g. europe) or ISO 3166-1 alpha-2 countries (e.g. DE) the sandbox may run in, most preferred first; omitted places it on the best machine nearest to the caller',
	})
	@ValidateIf(
		(placement: SandboxPlacementRequestDto) =>
			isFlexible(placement) && placement.locations !== undefined
	)
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(PLACEMENT_LOCATION_LIMIT)
	@IsLocationCode({ each: true })
	locations?: string[];

	@ApiPropertyOptional({
		default: false,
		description:
			"Place the sandbox only on the organization's own machines; machine time on them is free and does not count against quotas, while network traffic through Snapflow edges is still billed",
	})
	@ValidateIf(
		(placement: SandboxPlacementRequestDto) =>
			isFlexible(placement) && placement.ownMachinesOnly !== undefined
	)
	@IsBoolean()
	ownMachinesOnly?: boolean;

	@ApiPropertyOptional({
		default: false,
		description:
			"Rent the whole pinned machine at its machine price: the sandbox takes the machine's full offered shape, starts only while no other sandbox runs there, and keeps every other sandbox off it while it runs",
	})
	@IsOptional()
	@IsBoolean()
	wholeMachine?: boolean;

	@ApiPropertyOptional({ enum: MachineTier, enumName: 'MachineTier' })
	@ValidateIf(
		(placement: SandboxPlacementRequestDto) =>
			isFlexible(placement) && placement.minimumTier !== undefined
	)
	@IsEnum(MachineTier)
	minimumTier?: MachineTier;

	@ApiPropertyOptional({
		default: false,
		description:
			"Run on hosts' idle capacity at the interruptible price; the sandbox is stopped and archived when an on-demand sandbox needs the capacity, and starts again on any machine",
	})
	@ValidateIf(
		(placement: SandboxPlacementRequestDto) =>
			isFlexible(placement) && placement.interruptible !== undefined
	)
	@IsBoolean()
	interruptible?: boolean;

	@ApiPropertyOptional({
		type: String,
		description:
			'Highest all-in hourly price accepted, in micro-USD; flexible placement or a whole-machine rental',
	})
	@ValidateIf(
		(placement: SandboxPlacementRequestDto) =>
			takesMaximumPrice(placement) &&
			placement.maxHourlyPriceMicroUsd !== undefined
	)
	@Matches(MICRO_USD_PATTERN)
	maxHourlyPriceMicroUsd?: string;
}

@ApiSchema({ name: 'SandboxPlacement' })
export class SandboxPlacementDto {
	@ApiProperty({ enum: PlacementKind, enumName: 'PlacementKind' })
	kind: PlacementKind;

	@ApiPropertyOptional({ format: 'uuid' })
	machineId?: string;

	@ApiPropertyOptional({ enum: MachineCategory, enumName: 'MachineCategory' })
	category?: MachineCategory;

	@ApiProperty({ type: [String] })
	locations: string[];

	@ApiProperty()
	ownMachinesOnly: boolean;

	@ApiProperty()
	wholeMachine: boolean;

	@ApiProperty()
	interruptible: boolean;

	@ApiPropertyOptional({ enum: MachineTier, enumName: 'MachineTier' })
	minimumTier?: MachineTier;

	@ApiPropertyOptional({ type: String })
	maxHourlyPriceMicroUsd?: string;

	@ApiPropertyOptional({ type: String, format: 'date-time' })
	startWaitUntil?: Date;
}

@ApiSchema({ name: 'StartSandbox' })
export class StartSandboxDto {
	@ApiPropertyOptional({
		enum: WhenMachineUnavailable,
		enumName: 'WhenMachineUnavailable',
		default: WhenMachineUnavailable.FAIL,
		description:
			'What a pinned sandbox does when its machine is full, offline, draining or unlisted',
	})
	@IsOptional()
	@IsEnum(WhenMachineUnavailable)
	whenMachineUnavailable: WhenMachineUnavailable = WhenMachineUnavailable.FAIL;

	@ApiPropertyOptional({
		type: String,
		description:
			'Highest all-in hourly price accepted when the sandbox moves, in micro-USD',
	})
	@IsOptional()
	@Matches(MICRO_USD_PATTERN)
	maxHourlyPriceMicroUsd?: string;
}

@ApiSchema({ name: 'MoveSandbox' })
export class MoveSandboxDto {
	@ApiPropertyOptional({
		format: 'uuid',
		description:
			'Machine to move to; omitted moves to the best matching machine',
	})
	@IsOptional()
	@IsUUID()
	machineId?: string;

	@ApiPropertyOptional({
		type: String,
		description: 'Highest all-in hourly price accepted, in micro-USD',
	})
	@IsOptional()
	@Matches(MICRO_USD_PATTERN)
	maxHourlyPriceMicroUsd?: string;
}
