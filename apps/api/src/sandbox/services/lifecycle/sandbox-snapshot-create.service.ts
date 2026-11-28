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
import { AccessDeniedException } from '../../../common/exceptions/access-denied.exception';
import type { HumanPrincipal } from '../../../common/types/platform-principal.types';
import { apiError } from '../../../common/utils/error/api-error.util';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { errorConstraint } from '../../../common/utils/error/error.util';
import { ResourceShape } from '../../../common/values/resource-shape.value';
import { observeOperation } from '../../../infra/logging/utils/operation-observability.util';
import type { CustomerMachineParams } from '../../../machine/types/machine-scheduling.types';
import { machineWorkloadFingerprint } from '../../../machine/utils/machine-workload-fingerprint.util';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../../organization/services/organization-quota.service';
import { NoAvailableMachineError } from '../../../placement/exceptions/no-available-machine.exception';
import {
	MachineReservationService,
	type ReservedMachine,
} from '../../../placement/services/machine-reservation.service';
import { MachineSchedulingService } from '../../../placement/services/machine-scheduling.service';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import { resolveGpuTypePreferences } from '../../../placement/utils/gpu-type-preferences.util';
import {
	type PendingQuotaUsage,
	pendingQuotaUsage,
} from '../../../placement/utils/pending-quota-usage.util';
import {
	placementRequest,
	type ResolvedPlacement,
} from '../../../placement/utils/sandbox-placement.util';
import { SecretService } from '../../../secrets/services/secret.service';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { SnapshotErrorCode } from '../../../snapshot/enums/snapshot-error-code.enum';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { SandboxSnapshotLookupService } from '../../../snapshot/services/sandbox-snapshot-lookup.service';
import {
	type SnapshotSandboxShape,
	snapshotSandboxShape,
} from '../../../snapshot/utils/snapshot-shape.util';
import { CreateSandboxDto } from '../../dto/create-sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxPlacementErrorCode } from '../../enums/sandbox-placement-error-code.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { normalizeSandboxCapabilities } from '../../utils/runtime/sandbox-capabilities.util';
import { SandboxAdmissionService } from '../admission/sandbox-admission.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';
import { SandboxRuntimeSpecService } from '../sandbox/sandbox-runtime-spec.service';
import { SandboxCreateNotifier } from './sandbox-create-notifier.service';
import { SandboxStartWaitService } from './sandbox-start-wait.service';

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
			apiError(
				SandboxErrorCode.LINK_INVALID,
				'The linked sandbox was just paired with another sandbox. Choose another sandbox to link.'
			)
		);
	}
	return new ConflictException(
		apiError(
			SandboxErrorCode.NAME_TAKEN,
			`A sandbox named ${name} already exists. Choose another name.`
		)
	);
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
		private readonly quotas: OrganizationQuotaService,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly organizations: OrganizationService,
		private readonly secretService: SecretService,
		private readonly createNotifier: SandboxCreateNotifier,
		private readonly runtimeSpecs: SandboxRuntimeSpecService,
		private readonly machineScheduling: MachineSchedulingService,
		private readonly startWaits: SandboxStartWaitService
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
			const shape = rentedSnapshotShape(
				snapshotSandboxShape(createSandboxDto, activeSnapshot),
				placement
			);

			if (shape.gpu > 0 && isEphemeral(createSandboxDto)) {
				throw new BadRequestException(
					apiError(
						SandboxErrorCode.MODE_INVALID,
						'GPU sandboxes must use standard mode. Remove the mode or set it to standard.'
					)
				);
			}

			const quota = placement.ownMachinesOnly
				? null
				: await this.quotas.find(organizationId, activeSnapshot.sandboxClass);
			const gpuTypePreferences = resolveGpuTypePreferences(
				shape.gpu,
				shape.gpuType ? [shape.gpuType] : undefined,
				quota?.allowedGpuTypes
			);

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
						quota,
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
			await this.admission.assertPaymentsSignable(
				sandbox,
				placement.ownMachinesOnly
			);
			const schedulingParameters = snapshotSchedulingParameters(
				createSandboxDto,
				active,
				sandbox,
				gpuTypePreferences
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

			const persistRelated = (persistManager: EntityManager) =>
				this.secretService.bindToSandbox(
					persistManager,
					organizationId,
					sandbox.id,
					sandbox.env,
					createSandboxDto.secretEnv,
					principal
				);
			const insertedSandbox = await observeOperation(
				'sandbox.scheduling.reservation',
				{
					...admissionAttributes,
					'sandbox.class': activeSnapshot.sandboxClass,
				},
				async () => {
					try {
						return await this.sandboxRepository.insertWithMachineReservation(
							sandbox,
							{
								reserveMachine,
								persistRelated,
								manager,
								runtimeIntent: (machineId) =>
									this.runtimeSpecs.imageIntent(sandbox, machineId),
							}
						);
					} catch (error) {
						if (
							!(error instanceof NoAvailableMachineError) ||
							linkedSandbox ||
							!(await this.machineScheduling.placementCanEverBeMet(
								schedulingParameters
							))
						) {
							throw error;
						}
						sandbox.machineId = null;
						sandbox.state = SandboxState.PENDING_PLACEMENT;
						sandbox.startWaitUntil = await this.startWaits.deadline();
						return this.sandboxRepository.insert(
							sandbox,
							undefined,
							persistRelated,
							manager
						);
					}
				}
			);

			this.createNotifier.notifyCreated(insertedSandbox, admissionAttributes);

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
				apiError(
					SnapshotErrorCode.NOT_FOUND,
					`Snapshot ${snapshotIdOrName} was not found. Check the snapshot name, or create it on the Snapshots page first.`
				)
			);
		}

		if (PREPARING_SNAPSHOT_STATES.has(snapshot.state)) {
			throw new ConflictException(
				apiError(
					SnapshotErrorCode.NOT_READY,
					`Snapshot ${snapshotIdOrName} is still being prepared (${snapshot.state}). Try again in a few minutes.`
				)
			);
		}
		if (snapshot.state !== SnapshotState.ACTIVE) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.NOT_READY,
					`Snapshot ${snapshotIdOrName} is ${snapshot.state} and cannot be used. Choose an active snapshot.`
				)
			);
		}

		if (!snapshot.ref) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.NOT_READY,
					'The snapshot has no image yet. Wait for it to finish building, then try again.'
				)
			);
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
					apiError(
						SandboxPlacementErrorCode.MACHINE_UNAVAILABLE,
						'The machine of the linked sandbox is unavailable or full. Try again later.'
					)
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
		| 'placementWholeMachine'
		| 'placementInterruptible'
		| 'originLatitude'
		| 'originLongitude'
		| 'placementMinimumTier'
		| 'maxHourlyPriceMicroUsd'
		| 'cpu'
		| 'mem'
		| 'disk'
		| 'gpu'
	>,
	gpuTypePreferences: ReturnType<typeof resolveGpuTypePreferences>
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
		gpuType: gpuTypePreferences ?? null,
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

function rentedSnapshotShape(
	shape: SnapshotSandboxShape,
	{ wholeMachine }: ResolvedPlacement
): SnapshotSandboxShape {
	if (!wholeMachine) return shape;
	return {
		...shape,
		cpu: wholeMachine.cpu,
		mem: wholeMachine.memoryGiB,
		gpu: wholeMachine.gpu,
		gpuType: wholeMachine.gpuType,
	};
}
