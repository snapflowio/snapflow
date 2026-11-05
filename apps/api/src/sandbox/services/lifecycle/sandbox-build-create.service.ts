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
import { AccessDeniedException } from '../../../common/exceptions/access-denied.exception';
import type { HumanPrincipal } from '../../../common/types/platform-principal.types';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { ResourceShape } from '../../../common/values/resource-shape.value';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../../organization/services/organization-quota.service';
import { SecretService } from '../../../secrets/services/secret.service';
import {
	BUILD_SANDBOX_CLASS,
	BUILD_SANDBOX_DEFAULT_RESOURCES,
} from '../../constants/sandbox-build.constants';
import { CreateSandboxDto } from '../../dto/create-sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { Machine } from '../../machine/entities/machine.entity';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import { machineWorkloadFingerprint } from '../../machine/utils/machine-workload-fingerprint.util';
import { NoAvailableMachineError } from '../../placement/exceptions/no-available-machine.exception';
import { MachineReservationService } from '../../placement/services/machine-reservation.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { SandboxPlacementResolverService } from '../../placement/services/sandbox-placement-resolver.service';
import { resolveGpuTypePreferences } from '../../placement/utils/gpu-type-preferences.util';
import {
	type PendingQuotaUsage,
	pendingQuotaUsage,
} from '../../placement/utils/pending-quota-usage.util';
import { placementRequest } from '../../placement/utils/sandbox-placement.util';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import {
	BuildInfo,
	generateBuildInfoHash as generateBuildSnapshotRef,
} from '../../snapshot/entities/build-info.entity';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { SandboxAdmissionService } from '../admission/sandbox-admission.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';
import { SandboxCreateNotifier } from './sandbox-create-notifier.service';

const BUILD_INFO_UPDATE_LOCK_TTL_SECONDS = 60;

@Injectable()
export class SandboxBuildCreateService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly admission: SandboxAdmissionService,
		private readonly placements: SandboxPlacementResolverService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly machineReservations: MachineReservationService,
		private readonly machineScheduling: MachineSchedulingService,
		private readonly quota: SandboxQuotaService,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly quotas: OrganizationQuotaService,
		private readonly organizations: OrganizationService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly secretService: SecretService,
		private readonly createNotifier: SandboxCreateNotifier
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
		const placement = await this.placements.resolvePlacement(
			organizationId,
			createSandboxDto.placement,
			callerAddress
		);
		const buildInfo = createSandboxDto.buildInfo;
		if (!buildInfo) {
			throw new BadRequestException(
				'Build information is required to create a sandbox from a build'
			);
		}
		let pending: PendingQuotaUsage = {};

		try {
			const usage = {
				cpu: createSandboxDto.cpu || BUILD_SANDBOX_DEFAULT_RESOURCES.cpu,
				memory:
					createSandboxDto.memory || BUILD_SANDBOX_DEFAULT_RESOURCES.memoryGiB,
				disk: createSandboxDto.disk || BUILD_SANDBOX_DEFAULT_RESOURCES.diskGiB,
				gpu: createSandboxDto.gpu || BUILD_SANDBOX_DEFAULT_RESOURCES.gpu,
			};

			if (usage.gpu > 0 && isEphemeral(createSandboxDto)) {
				throw new BadRequestException('GPU sandboxes require standard mode');
			}

			const quota = placement.ownMachinesOnly
				? null
				: await this.quotas.find(organizationId, BUILD_SANDBOX_CLASS);
			const gpuTypePreferences = resolveGpuTypePreferences(
				usage.gpu,
				createSandboxDto.gpuType,
				quota?.allowedGpuTypes
			);

			const reservation = await this.quota.validateOrganizationQuotas({
				organizationLimits,
				sandboxClass: BUILD_SANDBOX_CLASS,
				usage,
				ephemeral: isEphemeral(createSandboxDto),
				ownMachinesOnly: placement.ownMachinesOnly,
				quota,
			});
			pending = pendingQuotaUsage(reservation, usage);

			const resolvedVolumes = await this.admission.resolveVolumes(
				organizationId,
				createSandboxDto.volumes
			);

			const sandbox = await this.admission.newSandbox(
				createSandboxDto,
				organizationLimits,
				placement,
				{
					sandboxClass: BUILD_SANDBOX_CLASS,
					cpu: usage.cpu,
					mem: usage.memory,
					disk: usage.disk,
					gpu: usage.gpu,
				},
				resolvedVolumes
			);

			const buildInfoSnapshotRef = generateBuildSnapshotRef(
				buildInfo.dockerfileContent,
				buildInfo.contextHashes
			);
			const schedulingParameters = buildSchedulingParameters(
				sandbox,
				buildInfoSnapshotRef,
				gpuTypePreferences
			);
			sandbox.buildInfo = await this.useBuildInfo(
				createSandboxDto,
				buildInfoSnapshotRef,
				manager
			);
			sandbox.pending = true;

			const insertedSandbox = await this.insert(
				sandbox,
				schedulingParameters,
				placement.expectedPriceCardId,
				(persistManager) =>
					this.secretService.bindToSandbox(
						persistManager,
						organizationId,
						sandbox.id,
						sandbox.env,
						createSandboxDto.secretEnv,
						principal
					),
				manager
			);

			if (!manager) this.createNotifier.notifyCreated(insertedSandbox);

			return insertedSandbox;
		} catch (error) {
			await this.quota.rollbackPendingUsage(
				organizationId,
				BUILD_SANDBOX_CLASS,
				pending.cpu,
				pending.memory,
				pending.disk,
				pending.gpu
			);

			if (isUniqueViolation(error)) {
				throw new ConflictException(
					`Sandbox with name ${createSandboxDto.name} already exists`
				);
			}

			throw error;
		}
	}

	private async insert(
		sandbox: Sandbox,
		schedulingParameters: CustomerMachineParams,
		expectedPriceCardId: string | undefined,
		persistRelated: (manager: EntityManager) => Promise<void>,
		manager: EntityManager | undefined
	): Promise<Sandbox> {
		try {
			return await this.sandboxRepository.insertWithMachineReservation(
				sandbox,
				{
					reserveMachine: async (reservationManager) => {
						const reserved = await this.machineReservations.reserve(
							reservationManager,
							schedulingParameters,
							[],
							expectedPriceCardId
						);
						sandbox.gpuType =
							sandbox.gpu > 0
								? (
										await reservationManager.findOneOrFail(Machine, {
											id: reserved.machine.id,
										})
									).gpuType
								: null;
						return reserved;
					},
					persistRelated,
					manager,
				}
			);
		} catch (error) {
			if (
				!(error instanceof NoAvailableMachineError) ||
				!(await this.machineScheduling.placementCanEverBeMet(
					schedulingParameters
				))
			) {
				throw error;
			}
			sandbox.machineId = null;
			sandbox.gpuType = null;
			sandbox.state = SandboxState.PENDING_BUILD;
			return this.sandboxRepository.insert(
				sandbox,
				undefined,
				persistRelated,
				manager
			);
		}
	}

	private async useBuildInfo(
		createSandboxDto: CreateSandboxDto,
		snapshotRef: string,
		manager: EntityManager | undefined
	): Promise<BuildInfo> {
		const entityManager = manager ?? this.entityManager;
		const buildInfoRepository = entityManager.getRepository(BuildInfo);
		const existingBuildInfo = await buildInfoRepository.findOne({
			snapshotRef,
		});

		if (existingBuildInfo) {
			if (
				await this.redisLockProvider.claim(
					`build-info:${existingBuildInfo.snapshotRef}:update`,
					BUILD_INFO_UPDATE_LOCK_TTL_SECONDS
				)
			) {
				const lastUsedAt = new Date();
				await buildInfoRepository.nativeUpdate(
					{ snapshotRef: existingBuildInfo.snapshotRef },
					{ lastUsedAt, updatedAt: lastUsedAt }
				);
			}
			return existingBuildInfo;
		}

		const now = new Date();
		const buildInfoEntity = buildInfoRepository.create({
			...createSandboxDto.buildInfo,
			snapshotRef,
			lastUsedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		entityManager.persist(buildInfoEntity);
		return buildInfoEntity;
	}
}

function buildSchedulingParameters(
	sandbox: Sandbox,
	buildInfoSnapshotRef: string,
	gpuTypePreferences: ReturnType<typeof resolveGpuTypePreferences>
): CustomerMachineParams {
	return {
		customerOrganizationId: sandbox.organizationId,
		placement: placementRequest(sandbox),
		sandboxClass: sandbox.sandboxClass,
		snapshotRef: buildInfoSnapshotRef,
		snapshotRequired: true,
		...ResourceShape.fromSandbox(sandbox),
		gpuType: gpuTypePreferences ?? null,
		mode: sandbox.mode,
		capabilities: sandbox.capabilities,
		volumeIds: (sandbox.volumes ?? []).map(({ volumeId }) => volumeId),
		workloadFingerprint: machineWorkloadFingerprint({
			snapshot: null,
			sandboxClass: sandbox.sandboxClass,
			mode: sandbox.mode,
			capabilities: sandbox.capabilities,
			...ResourceShape.fromSandbox(sandbox),
		}),
	};
}
