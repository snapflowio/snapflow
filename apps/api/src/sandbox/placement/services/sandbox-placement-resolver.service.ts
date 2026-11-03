/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { GeoIpService } from '../../../location/services/geo-ip.service';
import { parseLocationConstraint } from '../../../location/utils/location-constraint.util';
import { MachineListing } from '../../../marketplace/machine/entities/machine-listing.entity';
import { ListingVisibility } from '../../../marketplace/machine/enums/listing-visibility.enum';
import { MarketplaceErrorCode } from '../../../marketplace/machine/enums/marketplace-error-code.enum';
import { PlacementKind } from '../../../marketplace/machine/enums/placement-kind.enum';
import type { SandboxPlacementRequestDto } from '../../instance/dto/sandbox-placement.dto';
import type { Sandbox } from '../../instance/entities/sandbox.entity';
import { Machine } from '../../machine/entities/machine.entity';
import type { ResolvedPlacement } from '../utils/sandbox-placement.util';

@Injectable()
export class SandboxPlacementResolverService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly geoIp: GeoIpService
	) {}

	async resolvePlacement(
		organizationId: string,
		request: SandboxPlacementRequestDto | undefined,
		callerAddress: string | undefined
	): Promise<ResolvedPlacement> {
		if (request?.kind === PlacementKind.PINNED && request.machineId) {
			return this.resolvePinnedPlacement(
				organizationId,
				request.machineId,
				request.expectedPriceCardId
			);
		}
		const ownMachinesOnly = request?.ownMachinesOnly ?? false;
		const caller = this.geoIp.locate(callerAddress);
		return {
			ownMachinesOnly,
			request: {
				kind: PlacementKind.FLEXIBLE,
				locations: [...new Set(request?.locations ?? [])].map(
					parseLocationConstraint
				),
				ownMachinesOnly,
				origin: caller
					? { latitude: caller.latitude, longitude: caller.longitude }
					: null,
				category: request?.category,
				minimumTier: request?.minimumTier,
				maxHourlyPriceMicroUsd:
					request?.maxHourlyPriceMicroUsd === undefined
						? undefined
						: MicroUsd.parse(request.maxHourlyPriceMicroUsd),
				maxEgressMicroUsdPerGiB:
					request?.maxEgressMicroUsdPerGiB === undefined
						? undefined
						: MicroUsd.parse(request.maxEgressMicroUsdPerGiB),
			},
		};
	}

	async runsOnOwnMachines(
		sandbox: Pick<
			Sandbox,
			| 'organizationId'
			| 'placementKind'
			| 'pinnedMachineId'
			| 'placementOwnMachinesOnly'
		>
	): Promise<boolean> {
		if (sandbox.placementKind === PlacementKind.FLEXIBLE) {
			return sandbox.placementOwnMachinesOnly;
		}
		if (!sandbox.pinnedMachineId) return false;
		const machine = await this.entityManager.findOne(
			Machine,
			{ id: sandbox.pinnedMachineId },
			{ fields: ['organizationId'] }
		);
		return machine?.organizationId === sandbox.organizationId;
	}

	private async resolvePinnedPlacement(
		organizationId: string,
		machineId: string,
		expectedPriceCardId: string | undefined
	): Promise<ResolvedPlacement> {
		const machine = await this.entityManager.findOne(Machine, {
			id: machineId,
		});
		const listing = machine
			? await this.entityManager.findOne(MachineListing, { machineId })
			: null;
		if (
			!machine ||
			!listing ||
			(machine.organizationId !== organizationId &&
				listing.visibility !== ListingVisibility.PUBLIC)
		) {
			throw new NotFoundException({
				code: MarketplaceErrorCode.MACHINE_NOT_FOUND,
				message: 'Machine not found',
			});
		}
		return {
			ownMachinesOnly: machine.organizationId === organizationId,
			request: { kind: PlacementKind.PINNED, machineId },
			expectedPriceCardId,
		};
	}
}
