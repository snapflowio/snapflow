/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { GeoPoint } from '../../../location/types/geo-location.types';
import { geoPoint } from '../../../location/utils/geo-distance.util';
import {
	locationConstraintCode,
	parseLocationConstraint,
} from '../../../location/utils/location-constraint.util';
import { MachineTier } from '../../../marketplace/enums/machine-tier.enum';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import type { SandboxPlacementDto } from '../../dto/sandbox-placement.dto';
import type { Sandbox } from '../../entities/sandbox.entity';
import type {
	FlexiblePlacement,
	PlacementRequest,
} from '../../machine/types/machine-scheduling.types';

export interface ResolvedPlacement {
	request: PlacementRequest;
	ownMachinesOnly: boolean;
	expectedPriceCardId?: string;
}

type PlacementColumns = Pick<
	Sandbox,
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

export function applyPlacement(
	sandbox: PlacementColumns,
	placement: Pick<ResolvedPlacement, 'request'>
): void {
	const { request } = placement;
	sandbox.placementKind = request.kind;
	if (request.kind === PlacementKind.PINNED) {
		sandbox.pinnedMachineId = request.machineId;
		sandbox.placementCategory = null;
		sandbox.placementLocations = [];
		sandbox.placementOwnMachinesOnly = false;
		sandbox.originLatitude = null;
		sandbox.originLongitude = null;
		sandbox.placementMinimumTier = null;
		sandbox.maxHourlyPriceMicroUsd = null;
		sandbox.maxEgressMicroUsdPerGiB = null;
		return;
	}
	sandbox.pinnedMachineId = null;
	sandbox.placementCategory = request.category ?? null;
	sandbox.placementLocations = request.locations.map(locationConstraintCode);
	sandbox.placementOwnMachinesOnly = request.ownMachinesOnly;
	sandbox.originLatitude = request.origin?.latitude ?? null;
	sandbox.originLongitude = request.origin?.longitude ?? null;
	sandbox.placementMinimumTier = request.minimumTier ?? null;
	sandbox.maxHourlyPriceMicroUsd =
		request.maxHourlyPriceMicroUsd?.toString() ?? null;
	sandbox.maxEgressMicroUsdPerGiB =
		request.maxEgressMicroUsdPerGiB?.toString() ?? null;
}

export function placementRequest(sandbox: PlacementColumns): PlacementRequest {
	if (
		sandbox.placementKind === PlacementKind.PINNED &&
		sandbox.pinnedMachineId
	) {
		return { kind: PlacementKind.PINNED, machineId: sandbox.pinnedMachineId };
	}
	return {
		kind: PlacementKind.FLEXIBLE,
		locations: sandbox.placementLocations.map(parseLocationConstraint),
		ownMachinesOnly: sandbox.placementOwnMachinesOnly,
		origin: geoPoint({
			latitude: sandbox.originLatitude,
			longitude: sandbox.originLongitude,
		}),
		category: sandbox.placementCategory ?? undefined,
		minimumTier: sandbox.placementMinimumTier ?? undefined,
		maxHourlyPriceMicroUsd:
			sandbox.maxHourlyPriceMicroUsd === null
				? undefined
				: MicroUsd.parse(sandbox.maxHourlyPriceMicroUsd),
		maxEgressMicroUsdPerGiB:
			MicroUsd.parseNullable(sandbox.maxEgressMicroUsdPerGiB) ?? undefined,
	};
}

export function sandboxPlacementDto(
	sandbox: PlacementColumns & Pick<Sandbox, 'startWaitUntil'>
): SandboxPlacementDto {
	return {
		kind: sandbox.placementKind,
		machineId: sandbox.pinnedMachineId ?? undefined,
		category: sandbox.placementCategory ?? undefined,
		locations: sandbox.placementLocations,
		ownMachinesOnly: sandbox.placementOwnMachinesOnly,
		minimumTier: sandbox.placementMinimumTier ?? undefined,
		maxHourlyPriceMicroUsd: sandbox.maxHourlyPriceMicroUsd ?? undefined,
		maxEgressMicroUsdPerGiB: sandbox.maxEgressMicroUsdPerGiB ?? undefined,
		startWaitUntil: sandbox.startWaitUntil ?? undefined,
	};
}

export function platformWorkloadPlacement(
	origin: GeoPoint | null = null
): FlexiblePlacement {
	return {
		kind: PlacementKind.FLEXIBLE,
		locations: [],
		ownMachinesOnly: false,
		origin,
		minimumTier: MachineTier.COMMUNITY,
	};
}
