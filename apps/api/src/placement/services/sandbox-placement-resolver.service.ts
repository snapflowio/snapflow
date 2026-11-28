/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { GeoIpService } from '../../location/services/geo-ip.service';
import { parseLocationConstraint } from '../../location/utils/location-constraint.util';
import { Machine } from '../../machine/entities/machine.entity';
import type { WholeMachineShape } from '../../machine/types/machine-scheduling.types';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import type { SandboxPlacementRequestDto } from '../../sandbox/dto/sandbox-placement.dto';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { PlacementErrorCode } from '../enums/placement-error-code.enum';
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
		const maxHourlyPriceMicroUsd =
			request?.maxHourlyPriceMicroUsd === undefined
				? undefined
				: MicroUsd.parse(request.maxHourlyPriceMicroUsd);
		if (request?.kind === PlacementKind.PINNED && request.machineId) {
			return this.resolvePinnedPlacement(organizationId, request.machineId, {
				expectedPriceCardId: request.expectedPriceCardId,
				wholeMachine: request.wholeMachine ?? false,
				maxHourlyPriceMicroUsd,
			});
		}
		if (request?.wholeMachine) {
			throw new BadRequestException(
				apiError(
					PlacementErrorCode.WHOLE_MACHINE_REQUIRES_PINNED_PLACEMENT,
					'Renting a whole machine needs a specific machine. Set placement.machineId to the machine you want to rent.'
				)
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
				wholeMachine: false,
				origin: caller
					? { latitude: caller.latitude, longitude: caller.longitude }
					: null,
				category: request?.category,
				minimumTier: request?.minimumTier,
				interruptible: request?.interruptible,
				maxHourlyPriceMicroUsd,
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
		pin: PinOptions
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
		const ownMachine = machine.organizationId === organizationId;
		const resolved: ResolvedPlacement = {
			ownMachinesOnly: ownMachine,
			request: {
				kind: PlacementKind.PINNED,
				machineId,
				wholeMachine: pin.wholeMachine,
				maxHourlyPriceMicroUsd: pin.wholeMachine
					? pin.maxHourlyPriceMicroUsd
					: undefined,
			},
			expectedPriceCardId: pin.expectedPriceCardId,
		};
		if (!pin.wholeMachine) return resolved;
		const card =
			ownMachine || !listing.currentPriceCardId
				? null
				: await this.entityManager.findOneOrFail(MachinePriceCard, {
						id: listing.currentPriceCardId,
					});
		if (!card) {
			throw new BadRequestException(
				apiError(
					PlacementErrorCode.WHOLE_MACHINE_NOT_RENTABLE,
					'This machine is not offered for whole-machine rental. Choose a listed machine with a whole-machine price.'
				)
			);
		}
		return {
			...resolved,
			expectedPriceCardId: pin.expectedPriceCardId ?? card.id,
			wholeMachine: wholeMachineShape(card, machine),
		};
	}
}

interface PinOptions {
	expectedPriceCardId: string | undefined;
	wholeMachine: boolean;
	maxHourlyPriceMicroUsd: MicroUsd | undefined;
}

function wholeMachineShape(
	card: Pick<MachinePriceCard, 'vcpu' | 'memoryGib' | 'gpuCount'>,
	machine: Pick<Machine, 'gpuType'>
): WholeMachineShape {
	return {
		cpu: card.vcpu,
		memoryGiB: card.memoryGib,
		gpu: card.gpuCount,
		gpuType: card.gpuCount > 0 ? machine.gpuType : null,
	};
}
