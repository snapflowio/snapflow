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
	ConflictException,
	Injectable,
} from '@nestjs/common';
import type { Attributes } from '@opentelemetry/api';
import { AccessDeniedException } from '../../../../common/exceptions/access-denied.exception';
import type { HumanPrincipal } from '../../../../common/types/platform-principal.types';
import { isUniqueViolation } from '../../../../common/utils/error/database-error.util';
import { errorConstraint } from '../../../../common/utils/error/error.util';
import { ResourceShape } from '../../../../common/values/resource-shape.value';
import { observeOperation } from '../../../../infra/logging/utils/operation-observability.util';
import { OrganizationService } from '../../../../organization/tenant/services/organization.service';
import { OrganizationLimitsService } from '../../../../organization/tenant/services/organization-limits.service';
import { SecretService } from '../../../../secrets/services/secret.service';
import type { CustomerMachineParams } from '../../../machine/types/machine-scheduling.types';
import { machineWorkloadFingerprint } from '../../../machine/utils/machine-workload-fingerprint.util';
import {
	MachineReservationService,
	type ReservedMachine,
} from '../../../placement/services/machine-reservation.service';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import {
	type PendingQuotaUsage,
	pendingQuotaUsage,
} from '../../../placement/utils/pending-quota-usage.util';
import { placementRequest } from '../../../placement/utils/sandbox-placement.util';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { SandboxSnapshotLookupService } from '../../../snapshot/services/sandbox-snapshot-lookup.service';
import { snapshotSandboxShape } from '../../../snapshot/utils/snapshot-shape.util';
import { CreateSandboxDto } from '../../dto/create-sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { normalizeSandboxCapabilities } from '../../utils/runtime/sandbox-capabilities.util';
import { SandboxAdmissionService } from '../admission/sandbox-admission.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';
import { SandboxRuntimeSpecService } from '../sandbox/sandbox-runtime-spec.service';
import { SandboxCreateNotifier } from './sandbox-create-notifier.service';

const LINKED_OWNER_UNIQUE_CONSTRAINT = 'UQ_sandbox_active_linked_owner';
const PREPARING_SNAPSHOT_STATES: ReadonlySet<SnapshotState> = new Set([
	SnapshotState.PENDING,
	SnapshotState.PULLING,
	SnapshotState.BUILDING,
]);

interface QuotaReservation {
	sandboxClass: SandboxClass;
	pending: PendingQuotaUsage;
}

interface ActiveSnapshot {
	snapshot: Snapshot;
	ref: string;
}

function sandboxCreateError(error: unknown, name: string | undefined): unknown {
	if (!isUniqueViolation(error)) {
		return error;
	}
	if (errorConstraint(error) === LINKED_OWNER_UNIQUE_CONSTRAINT) {
		return new ConflictException(
			'The requested linked sandbox was paired by another concurrent create'
		);
	}
	return new ConflictException(`Sandbox with name ${name} already exists`);
}

@Injectable()
export class SandboxSnapshotCreateService {
	constructor(
		private readonly admission: SandboxAdmissionService,
		private readonly placements: SandboxPlacementResolverService,
		private readonly snapshotLookup: SandboxSnapshotLookupService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly machineReservations: MachineReservationService,
		private readonly quota: SandboxQuotaService,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly organizations: OrganizationService,
		private readonly secretService: SecretService,
		private readonly createNotifier: SandboxCreateNotifier,
		private readonly runtimeSpecs: SandboxRuntimeSpecService
	) {}

	async create(
		createSandboxDto: CreateSandboxDto,
		organizationId: string,
		principal: HumanPrincipal,
		managedSecretUseAuthorized: boolean,
		callerAddress?: string,
		manager?: EntityManager
	): Promise<Sandbox> {
		if (createSandboxDto.secretEnv?.length && !managedSecretUseAuthorized) {
			throw new AccessDeniedException();
		}
		await this.organizations.assertActive(organizationId);
		const organizationLimits =
			await this.organizationLimitsService.get(organizationId);
		const admissionAttributes = {
			'sandbox.mode': createSandboxDto.mode,
		} as const;
		const placement = await observeOperation(
			'sandbox.admission.placement',
			admissionAttributes,
			() =>
				this.placements.resolvePlacement(
					organizationId,
					createSandboxDto.placement,
					callerAddress
				)
		);
		let reserved: QuotaReservation | undefined;

		try {
			const active = await this.resolveActiveSnapshot(
				createSandboxDto,
				organizationId,
				admissionAttributes
			);
			const activeSnapshot = active.snapshot;
			const shape = snapshotSandboxShape(createSandboxDto, activeSnapshot);

			if (shape.gpu > 0 && isEphemeral(createSandboxDto)) {
				throw new BadRequestException('GPU sandboxes require standard mode');
			}

			const linkedSandbox = await observeOperation(
				'sandbox.admission.link',
				admissionAttributes,
				() =>
					this.admission.resolveLinkedSandbox(createSandboxDto, organizationId)
			);

			const usage = {
				cpu: shape.cpu,
				memory: shape.mem,
				disk: shape.disk,
				gpu: shape.gpu,
			};
			const reservation = await observeOperation(
				'sandbox.admission.quota_reservation',
				{
					...admissionAttributes,
					'sandbox.class': activeSnapshot.sandboxClass,
					'sandbox.gpu_requested': shape.gpu > 0,
				},
				() =>
					this.quota.validateOrganizationQuotas({
						organizationLimits,
						sandboxClass: activeSnapshot.sandboxClass,
						usage,
						ephemeral: isEphemeral(createSandboxDto),
						ownMachinesOnly: placement.ownMachinesOnly,
					})
			);
			reserved = {
				sandboxClass: activeSnapshot.sandboxClass,
				pending: pendingQuotaUsage(reservation, usage),
			};

			const resolvedVolumes = await observeOperation(
				'sandbox.admission.volume_resolution',
				{
					...admissionAttributes,
					'sandbox.has_volumes': (createSandboxDto.volumes?.length ?? 0) > 0,
				},
				() =>
					this.admission.resolveVolumes(
						organizationId,
						createSandboxDto.volumes
					)
			);

			const sandbox = await this.admission.newSandbox(
				createSandboxDto,
				organizationLimits,
				linkedSandbox
					? { request: placementRequest(linkedSandbox) }
					: placement,
				shape,
				resolvedVolumes
			);
			sandbox.gpuType = shape.gpuType;
			const schedulingParameters = snapshotSchedulingParameters(
				createSandboxDto,
				active,
				sandbox
			);
			const reserveMachine = (reservationManager: EntityManager) =>
				this.reserveMachine(
					reservationManager,
					linkedSandbox,
					schedulingParameters,
					placement.expectedPriceCardId
				);
			sandbox.snapshot = activeSnapshot.name;
			sandbox.linkedSandboxId = linkedSandbox?.id ?? null;
			sandbox.pending = true;
			sandbox.state = SandboxState.CREATING;

			const insertedSandbox = await observeOperation(
				'sandbox.scheduling.reservation',
				{
					...admissionAttributes,
					'sandbox.class': activeSnapshot.sandboxClass,
				},
				() =>
					this.sandboxRepository.insertWithMachineReservation(sandbox, {
						reserveMachine,
						persistRelated: (persistManager) =>
							this.secretService.bindToSandbox(
								persistManager,
								organizationId,
								sandbox.id,
								sandbox.env,
								createSandboxDto.secretEnv,
								principal
							),
						manager,
						runtimeIntent: (machineId) =>
							this.runtimeSpecs.imageIntent(sandbox, machineId),
					})
			);

			if (!manager) {
				this.createNotifier.notifyCreated(insertedSandbox, admissionAttributes);
			}

			return insertedSandbox;
		} catch (error) {
			if (reserved) {
				await this.releaseReservation(organizationId, reserved);
			}
			throw sandboxCreateError(error, createSandboxDto.name);
		}
	}

	private async releaseReservation(
		organizationId: string,
		{ sandboxClass, pending }: QuotaReservation
	): Promise<void> {
		await this.quota.rollbackPendingUsage(
			organizationId,
			sandboxClass,
			pending.cpu,
			pending.memory,
			pending.disk,
			pending.gpu
		);
	}

	private async resolveActiveSnapshot(
		createSandboxDto: CreateSandboxDto,
		organizationId: string,
		admissionAttributes: Attributes
	): Promise<ActiveSnapshot> {
		const snapshotIdOrName =
			await this.snapshotLookup.requestedSnapshot(createSandboxDto);
		const snapshots = await observeOperation(
			'sandbox.admission.snapshot',
			admissionAttributes,
			() =>
				this.snapshotLookup.findSnapshotCandidates(
					organizationId,
					snapshotIdOrName
				)
		);
		const snapshot =
			snapshots.find((s) => s.state === SnapshotState.ACTIVE) ?? snapshots[0];
		if (!snapshot) {
			throw new BadRequestException(
				`Snapshot ${snapshotIdOrName} not found. Did you add it through the Snapflow Dashboard?`
			);
		}

		if (PREPARING_SNAPSHOT_STATES.has(snapshot.state)) {
			throw new ConflictException(
				`Snapshot ${snapshotIdOrName} is still being prepared (${snapshot.state}); retry shortly`
			);
		}
		if (snapshot.state !== SnapshotState.ACTIVE) {
			throw new BadRequestException(
				`Snapshot ${snapshotIdOrName} is ${snapshot.state}`
			);
		}

		if (!snapshot.ref) {
			throw new BadRequestException('Snapshot ref is not defined');
		}

		return { snapshot, ref: snapshot.ref };
	}

	private async reserveMachine(
		manager: EntityManager,
		linkedSandbox: Sandbox | undefined,
		schedulingParameters: CustomerMachineParams,
		expectedPriceCardId: string | undefined
	): Promise<ReservedMachine> {
		if (linkedSandbox?.machineId) {
			const linkedMachine = await this.machineReservations.reserveSpecific(
				manager,
				linkedSandbox.machineId,
				schedulingParameters
			);
			if (!linkedMachine) {
				throw new BadRequestException(
					'The machine of the linked sandbox is unavailable or lacks capacity'
				);
			}
			return linkedMachine;
		}
		return this.machineReservations.reserve(
			manager,
			schedulingParameters,
			[],
			expectedPriceCardId
		);
	}
}

function snapshotSchedulingParameters(
	createSandboxDto: CreateSandboxDto,
	{ snapshot, ref }: ActiveSnapshot,
	sandbox: Pick<
		Sandbox,
		| 'organizationId'
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
		| 'cpu'
		| 'mem'
		| 'disk'
		| 'gpu'
		| 'gpuType'
	>
): CustomerMachineParams {
	const capabilities = normalizeSandboxCapabilities(
		createSandboxDto.capabilities
	);
	return {
		customerOrganizationId: sandbox.organizationId,
		placement: placementRequest(sandbox),
		sandboxClass: snapshot.sandboxClass,
		snapshotRef: ref,
		...ResourceShape.fromSandbox(sandbox),
		gpuType: sandbox.gpuType ?? null,
		mode: createSandboxDto.mode,
		capabilities,
		volumeIds: (createSandboxDto.volumes ?? []).map(({ volumeId }) => volumeId),
		workloadFingerprint: machineWorkloadFingerprint({
			snapshot: snapshot.name,
			sandboxClass: snapshot.sandboxClass,
			mode: createSandboxDto.mode,
			capabilities,
			...ResourceShape.fromSandbox(sandbox),
		}),
	};
}
