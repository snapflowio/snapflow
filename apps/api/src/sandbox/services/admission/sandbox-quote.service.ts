/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PlacementBillingCapacityService } from '../../../billing/services/placement/placement-billing-capacity.service';
import { apiError } from '../../../common/utils/error/api-error.util';
import type { CustomerMachineParams } from '../../../machine/types/machine-scheduling.types';
import { MachineUnavailableReason } from '../../../marketplace/enums/machine-unavailable-reason.enum';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { FREE_TERMS } from '../../../marketplace/utils/pricing/pricing.util';
import { OrganizationService } from '../../../organization/services/organization.service';
import { requestedShape } from '../../../placement/queries/machine-candidates.query';
import { MachineAvailabilityService } from '../../../placement/services/machine-availability.service';
import { MachineSchedulingService } from '../../../placement/services/machine-scheduling.service';
import { PlacementQuoteService } from '../../../placement/services/placement-quote.service';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import { SnapshotErrorCode } from '../../../snapshot/enums/snapshot-error-code.enum';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { SandboxSnapshotLookupService } from '../../../snapshot/services/sandbox-snapshot-lookup.service';
import { snapshotSandboxShape } from '../../../snapshot/utils/snapshot-shape.util';
import {
	BUILD_SANDBOX_CLASS,
	BUILD_SANDBOX_DEFAULT_RESOURCES,
} from '../../constants/sandbox-build.constants';
import type {
	SandboxQuoteDto,
	SandboxQuoteRequestDto,
} from '../../dto/sandbox-quote.dto';

export type SandboxQuoteInput = Omit<SandboxQuoteRequestDto, 'placement'> &
	Partial<Pick<SandboxQuoteRequestDto, 'placement'>>;

@Injectable()
export class SandboxQuoteService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly placements: SandboxPlacementResolverService,
		private readonly snapshots: SandboxSnapshotLookupService,
		private readonly scheduling: MachineSchedulingService,
		private readonly capacity: PlacementBillingCapacityService,
		private readonly availability: MachineAvailabilityService,
		private readonly quotes: PlacementQuoteService,
		private readonly organizations: OrganizationService
	) {}

	async quote(
		request: SandboxQuoteInput,
		organizationId: string,
		callerAddress: string | undefined
	): Promise<SandboxQuoteDto> {
		await this.organizations.assertActive(organizationId);
		const params = await this.quoteParameters(
			organizationId,
			request,
			callerAddress
		);
		const manager = this.entityManager;
		const ranked = await this.scheduling.rank(params, manager);
		const {
			admitted: [best],
			restriction,
		} = await this.capacity.admit(manager, organizationId, ranked);
		if (best) {
			return this.quotes.quoteCandidate(manager, params, best, ranked.length);
		}
		const [top] = ranked;
		if (restriction && top) {
			return this.quotes.quoteTerms(manager, params, top.terms, {
				eligibleMachineCount: ranked.length,
				machine: { machineId: top.machineId, priceCardId: top.priceCardId },
				billingRestriction: restriction.restriction,
			});
		}
		if (params.placement.kind === PlacementKind.PINNED) {
			const { machineId } = params.placement;
			const pinned = await this.availability.pinnedTerms(
				manager,
				machineId,
				organizationId,
				requestedShape(params),
				params.placement.wholeMachine
			);
			return this.quotes.quoteTerms(manager, params, pinned.terms, {
				eligibleMachineCount: ranked.length,
				machine: { machineId, priceCardId: pinned.priceCardId },
				unavailableReason: await this.availability.reason(
					manager,
					params,
					machineId
				),
			});
		}
		return this.quotes.quoteTerms(manager, params, FREE_TERMS, {
			eligibleMachineCount: ranked.length,
			unavailableReason:
				ranked.length > 0
					? MachineUnavailableReason.EXPOSURE_LIMITED
					: MachineUnavailableReason.FULL,
		});
	}

	private async quoteParameters(
		organizationId: string,
		request: SandboxQuoteInput,
		callerAddress: string | undefined
	): Promise<CustomerMachineParams> {
		const placement = await this.placements.resolvePlacement(
			organizationId,
			request.placement,
			callerAddress
		);
		const explicit =
			request.cpu !== undefined ||
			request.memory !== undefined ||
			request.disk !== undefined ||
			request.gpu !== undefined ||
			request.gpuType !== undefined;
		const base = {
			customerOrganizationId: organizationId,
			placement: placement.request,
		};
		const whole = placement.wholeMachine;
		if (explicit && request.snapshot === undefined) {
			return {
				...base,
				sandboxClass: BUILD_SANDBOX_CLASS,
				cpu: request.cpu ?? BUILD_SANDBOX_DEFAULT_RESOURCES.cpu,
				memoryGiB: request.memory ?? BUILD_SANDBOX_DEFAULT_RESOURCES.memoryGiB,
				diskGiB: request.disk ?? BUILD_SANDBOX_DEFAULT_RESOURCES.diskGiB,
				gpu: request.gpu ?? BUILD_SANDBOX_DEFAULT_RESOURCES.gpu,
				gpuType: request.gpuType ?? null,
				...whole,
			};
		}
		const snapshotIdOrName = await this.snapshots.requestedSnapshot(request);
		const snapshots = await this.snapshots.findSnapshotCandidates(
			organizationId,
			snapshotIdOrName
		);
		const snapshot =
			snapshots.find(({ state }) => state === SnapshotState.ACTIVE) ??
			snapshots[0];
		if (!snapshot) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.NOT_FOUND,
					`Snapshot ${snapshotIdOrName} was not found. Check the snapshot name, or create it on the Snapshots page first.`
				)
			);
		}
		if (snapshot.state !== SnapshotState.ACTIVE || !snapshot.ref) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.NOT_READY,
					`Snapshot ${snapshotIdOrName} is not active. Choose an active snapshot.`
				)
			);
		}
		const shape = snapshotSandboxShape(request, snapshot);
		return {
			...base,
			sandboxClass: shape.sandboxClass,
			snapshotRef: snapshot.ref,
			cpu: shape.cpu,
			memoryGiB: shape.mem,
			diskGiB: shape.disk,
			gpu: shape.gpu,
			gpuType: shape.gpuType ?? null,
			...whole,
		};
	}
}
