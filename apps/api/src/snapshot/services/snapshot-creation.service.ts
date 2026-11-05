/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityData } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { entrypointFromDockerfile } from '../../common/utils/dockerfile.util';
import { DockerRegistryService } from '../../docker-registry/services/docker-registry.service';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { OrganizationLimits } from '../../organization/entities/organization-limits.entity';
import { OrganizationService } from '../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../organization/services/organization-quota.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { resolveGpuTypePreferences } from '../../placement/utils/gpu-type-preferences.util';
import { platformWorkloadPlacement } from '../../placement/utils/sandbox-placement.util';
import {
	DEFAULT_SNAPSHOT_CPU,
	DEFAULT_SNAPSHOT_DISK_GIB,
	DEFAULT_SNAPSHOT_GPU,
	DEFAULT_SNAPSHOT_IMAGE_NAME,
	DEFAULT_SNAPSHOT_MEMORY_GIB,
} from '../../sandbox/constants/sandbox.constants';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SettingsService } from '../../settings/services/settings.service';
import { CreateSnapshotDto } from '../dto/create-snapshot.dto';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotRepository } from '../repositories/snapshot.repository';
import {
	assertValidImageName,
	assertValidSnapshotName,
	normalizeEntrypoint,
} from '../utils/snapshot-validation.util';
import { persistUniquelyNamed } from '../utils/unique-snapshot-name.util';
import { SnapshotBuildRegistrationService } from './snapshot-build-registration.service';
import { SnapshotQuotaService } from './snapshot-quota.service';

const CREATED_SNAPSHOT_COUNT = 1;

type CreationPlan = Readonly<{
	organizationLimits: OrganizationLimits;
	sandboxClass: SandboxClass;
	gpuType: GpuType | null;
}>;

@Injectable()
export class SnapshotCreationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly quotas: OrganizationQuotaService,
		private readonly organizations: OrganizationService,
		private readonly machineScheduling: MachineSchedulingService,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly settings: SettingsService,
		private readonly snapshotQuota: SnapshotQuotaService,
		private readonly buildRegistration: SnapshotBuildRegistrationService
	) {}

	async createFromPull(
		organizationId: string,
		dto: CreateSnapshotDto,
		general = false
	): Promise<Snapshot> {
		const { imageName } = dto;
		if (!imageName) {
			throw new BadRequestException('Must specify an image name');
		}
		return this.create(
			organizationId,
			dto,
			async (plan) => {
				const data: EntityData<Snapshot> = {
					id: uuidv4(),
					organizationId,
					...dto,
					gpuType: plan.gpuType,
					entrypoint: normalizeEntrypoint(dto.entrypoint),
					mem: dto.memory,
					sandboxClass: plan.sandboxClass,
					state: SnapshotState.PENDING,
					general,
				};
				const snapshot = this.entityManager.create(Snapshot, data, {
					partial: true,
				});
				return this.snapshotRepository.insert(snapshot);
			},
			async () => {
				assertValidImageName(imageName);
				// Platform-owned general snapshots may come from platform registries;
				// tenant pulls may only use their own namespace there.
				if (general) return;
				await this.dockerRegistryService.assertSnapshotSourceAllowed(
					imageName,
					organizationId
				);
			}
		);
	}

	async createFromBuildInfo(
		organizationId: string,
		dto: CreateSnapshotDto,
		general = false
	): Promise<Snapshot> {
		const { buildInfo } = dto;
		if (!buildInfo) {
			throw new BadRequestException(
				'Build information is required to create a snapshot from a build'
			);
		}
		return this.create(organizationId, dto, (plan) =>
			this.entityManager.transactional(async (manager) => {
				const snapshot = manager.create(Snapshot, {
					id: uuidv4(),
					organizationId,
					name: dto.name,
					imageName: dto.imageName ?? DEFAULT_SNAPSHOT_IMAGE_NAME,
					cpu: dto.cpu ?? DEFAULT_SNAPSHOT_CPU,
					gpu: dto.gpu ?? DEFAULT_SNAPSHOT_GPU,
					disk: dto.disk ?? DEFAULT_SNAPSHOT_DISK_GIB,
					gpuType: plan.gpuType,
					entrypoint: normalizeEntrypoint(
						entrypointFromDockerfile(buildInfo.dockerfileContent)
					),
					mem: dto.memory ?? DEFAULT_SNAPSHOT_MEMORY_GIB,
					sandboxClass: plan.sandboxClass,
					state: SnapshotState.PENDING,
					general,
				});
				await this.buildRegistration.attachBuild(manager, {
					snapshot,
					buildInfo,
					organizationLimits: plan.organizationLimits,
				});
				return this.snapshotRepository.insert(snapshot);
			})
		);
	}

	private async create(
		organizationId: string,
		dto: CreateSnapshotDto,
		persist: (plan: CreationPlan) => Promise<Snapshot>,
		validateSource?: () => Promise<void>
	): Promise<Snapshot> {
		await this.organizations.assertActive(organizationId);
		let reservedSnapshotCount: number | undefined;
		try {
			assertValidSnapshotName(dto.name);
			await validateSource?.();

			const sandboxClass =
				dto.sandboxClass ?? (await this.settings.get()).defaultSandboxClass;
			await this.assertHasSchedulableMachine(sandboxClass);

			const quota = await this.quotas.find(organizationId, sandboxClass);
			const gpuTypePreferences = resolveGpuTypePreferences(
				dto.gpu ?? 0,
				dto.gpuType,
				quota?.allowedGpuTypes
			);

			await this.snapshotQuota.reserve(
				organizationId,
				sandboxClass,
				CREATED_SNAPSHOT_COUNT,
				{ cpu: dto.cpu, memory: dto.memory, disk: dto.disk, gpu: dto.gpu }
			);
			reservedSnapshotCount = CREATED_SNAPSHOT_COUNT;

			const gpuType = await this.resolveSnapshotGpuType(
				organizationId,
				sandboxClass,
				dto.gpu,
				gpuTypePreferences
			);
			const organizationLimits =
				await this.organizationLimitsService.get(organizationId);
			return await persistUniquelyNamed(dto.name, () =>
				persist({
					organizationLimits,
					sandboxClass,
					gpuType,
				})
			);
		} catch (error) {
			await this.snapshotQuota.release(organizationId, reservedSnapshotCount);
			throw error;
		}
	}

	private async assertHasSchedulableMachine(
		sandboxClass: SandboxClass
	): Promise<void> {
		const hasMachine =
			await this.machineScheduling.hasSchedulableMachine(sandboxClass);
		if (!hasMachine) {
			throw new BadRequestException(
				`No machines can run sandbox class '${sandboxClass}' yet. Try a different sandbox class.`
			);
		}
	}

	private async resolveSnapshotGpuType(
		organizationId: string,
		sandboxClass: SandboxClass,
		gpu: number | undefined,
		gpuTypePreferences: GpuType[] | undefined
	): Promise<GpuType | null> {
		if (!gpu) return null;

		const machine = await this.machineScheduling.findBestAvailableMachine({
			customerOrganizationId: organizationId,
			placement: platformWorkloadPlacement(),
			sandboxClass,
			gpu,
			gpuType: gpuTypePreferences ?? null,
		});
		return machine.gpuType;
	}
}
