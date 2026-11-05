/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import type { VolumeBackupRequest } from '@snapflow/machine-proto';
import {
	PULL_ACTIONS,
	PUSH_ACTIONS,
	REGISTRY_REPOSITORY,
	REGISTRY_TOKEN,
	RegistrySubjectKind,
} from '../../docker-registry/constants/registry-token.constants';
import { DockerRegistry } from '../../docker-registry/entities/docker-registry.entity';
import { RegistryTokenService } from '../../docker-registry/services/registry-token.service';
import {
	namespaceAccess,
	type RegistryAccess,
	type RegistryGrant,
	registrySubject,
	repositoryAccess,
} from '../../docker-registry/utils/registry-token-scope.util';
import { Machine } from '../../machine/entities/machine.entity';
import { ObjectStorageService } from '../../object-storage/services/object-storage.service';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { BuildInfo } from '../../snapshot/entities/build-info.entity';
import type { ResourceTypeForJobType } from '../dto/job-type-map.dto';
import { Job } from '../entities/job.entity';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { ResourceType } from '../enums/resource-type.enum';
import {
	backupVolumesPayload,
	buildSnapshotPayload,
	createBackupPayload,
	inspectSnapshotPayload,
	publishSnapshotPayload,
	snapshotSandboxPayload,
} from '../utils/job-payloads.util';
import {
	getSnapshotDigestJobResultMetadata,
	type SnapshotDigestJobResultMetadata,
} from '../utils/job-result-metadata.util';
import { type CreateJobOptions, JobService } from './job.service';

const INSPECT_SNAPSHOT_TIMEOUT_MS = 30_000;

function machineGrant(
	machine: Pick<Machine, 'id'>,
	access: readonly RegistryAccess[],
	ttlSeconds: number
): RegistryGrant {
	return {
		subject: registrySubject(RegistrySubjectKind.MACHINE, machine.id),
		access,
		ttlSeconds,
	};
}

/** Jobs that push or build run long enough to need the push lifetime. */
function pushGrant(
	machine: Pick<Machine, 'id'>,
	access: readonly RegistryAccess[]
): RegistryGrant {
	return machineGrant(machine, access, REGISTRY_TOKEN.PUSH_TTL_SECONDS);
}

@Injectable()
export class MachineJobDispatchService {
	private readonly logger = new Logger(MachineJobDispatchService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly jobService: JobService,
		private readonly objectStorageService: ObjectStorageService,
		private readonly registryTokens: RegistryTokenService
	) {}

	async createBackup(
		machine: Machine,
		sandbox: Sandbox,
		backupSnapshotName: string,
		registry: DockerRegistry,
		volumeBackups: VolumeBackupRequest[]
	): Promise<void> {
		const { assignmentGeneration } = await this.activePlacement(
			machine,
			sandbox.id
		);
		await this.createJob(
			machine,
			JobType.CREATE_BACKUP,
			ResourceType.SANDBOX,
			sandbox.id,
			createBackupPayload(
				backupSnapshotName,
				await this.registryTokens.authorize(
					registry,
					pushGrant(machine, [
						repositoryAccess(backupSnapshotName, PUSH_ACTIONS),
					])
				),
				volumeBackups,
				assignmentGeneration
			),
			{ assignmentGeneration, supersedePending: true }
		);
	}

	async backupVolumes(
		machine: Pick<Machine, 'id'>,
		sandboxId: string,
		volumeBackups: VolumeBackupRequest[]
	): Promise<void> {
		const { assignmentGeneration } = await this.activePlacement(
			machine,
			sandboxId
		);
		await this.createJob(
			machine,
			JobType.BACKUP_VOLUMES,
			ResourceType.SANDBOX,
			sandboxId,
			backupVolumesPayload(volumeBackups, assignmentGeneration),
			{ assignmentGeneration }
		);
	}

	async buildSnapshot(
		machine: Machine,
		buildInfo: BuildInfo,
		organizationId: string,
		cacheRegistry: DockerRegistry,
		sourceRegistries?: DockerRegistry[],
		registry?: DockerRegistry,
		pushToInternalRegistry?: boolean
	): Promise<void> {
		const contexts = await this.objectStorageService.getBuildContextDownloads(
			organizationId,
			buildInfo.contextHashes ?? []
		);
		const { uploadUrl: buildLogUploadUrl } =
			await this.objectStorageService.createBuildLogUpload(
				organizationId,
				buildInfo.snapshotRef
			);
		await this.createJob(
			machine,
			JobType.BUILD_SNAPSHOT,
			ResourceType.SNAPSHOT,
			buildInfo.snapshotRef,
			buildSnapshotPayload({
				snapshot: buildInfo.snapshotRef,
				dockerfile: buildInfo.dockerfileContent ?? undefined,
				ownerId: organizationId,
				contexts,
				buildLogUploadUrl,
				pushToInternalRegistry,
				sourceRegistries: sourceRegistries
					? await Promise.all(
							sourceRegistries.map((source) =>
								this.registryTokens.authorize(
									source,
									pushGrant(machine, [
										namespaceAccess(source.project, PULL_ACTIONS),
									])
								)
							)
						)
					: undefined,
				registry: await this.registryTokens.authorizeOptional(
					registry,
					pushGrant(machine, [
						repositoryAccess(buildInfo.snapshotRef, PUSH_ACTIONS),
					])
				),
				cacheRegistry: await this.registryTokens.authorize(
					cacheRegistry,
					pushGrant(machine, [
						namespaceAccess(cacheRegistry.project, PUSH_ACTIONS),
						namespaceAccess(REGISTRY_REPOSITORY.MIRROR_NAMESPACE, PULL_ACTIONS),
					])
				),
			})
		);
	}

	async publishSnapshot(
		machine: Machine,
		sourceRef: string,
		sourceRegistry: DockerRegistry | undefined,
		destinationRef: string,
		destinationRegistry: DockerRegistry
	): Promise<void> {
		await this.createJob(
			machine,
			JobType.PUBLISH_SNAPSHOT,
			ResourceType.SNAPSHOT,
			destinationRef,
			publishSnapshotPayload({
				sourceRef,
				sourceRegistry: await this.registryTokens.authorizeOptional(
					sourceRegistry,
					pushGrant(machine, [repositoryAccess(sourceRef, PULL_ACTIONS)])
				),
				destinationRef,
				destinationRegistry: await this.registryTokens.authorize(
					destinationRegistry,
					pushGrant(machine, [repositoryAccess(destinationRef, PUSH_ACTIONS)])
				),
			})
		);
	}

	async inspectSnapshotInRegistry(
		machine: Machine,
		snapshotName: string,
		registry?: DockerRegistry
	): Promise<SnapshotDigestJobResultMetadata> {
		const job = await this.createJob(
			machine,
			JobType.INSPECT_SNAPSHOT_IN_REGISTRY,
			ResourceType.SNAPSHOT,
			snapshotName,
			inspectSnapshotPayload(
				snapshotName,
				await this.registryTokens.authorizeOptional(
					registry,
					machineGrant(
						machine,
						[repositoryAccess(snapshotName, PULL_ACTIONS)],
						REGISTRY_TOKEN.PULL_TTL_SECONDS
					)
				)
			)
		);
		const completedJob = await this.jobService.waitJobCompletion(
			job.id,
			INSPECT_SNAPSHOT_TIMEOUT_MS
		);
		if (!completedJob) {
			throw new Error(
				`Inspect job ${job.id} for snapshot ${snapshotName} disappeared before machine ${machine.id} completed it`
			);
		}
		if (completedJob.status !== JobStatus.COMPLETED) {
			throw new Error(
				`Snapshot ${snapshotName} failed to inspect in registry on machine ${machine.id}. Error: ${completedJob.errorMessage}`
			);
		}
		const resultMetadata = getSnapshotDigestJobResultMetadata(completedJob);
		if (!resultMetadata) {
			throw new Error(
				`Snapshot ${snapshotName} returned invalid registry metadata on machine ${machine.id}`
			);
		}
		return resultMetadata;
	}

	async createSnapshotFromSandbox(
		machine: Machine,
		sandboxId: string,
		snapshotName: string,
		registry: DockerRegistry
	): Promise<void> {
		const { assignmentGeneration } = await this.activePlacement(
			machine,
			sandboxId
		);
		await this.createJob(
			machine,
			JobType.SNAPSHOT_SANDBOX,
			ResourceType.SANDBOX,
			sandboxId,
			snapshotSandboxPayload(
				snapshotName,
				await this.registryTokens.authorize(
					registry,
					pushGrant(machine, [repositoryAccess(snapshotName, PUSH_ACTIONS)])
				),
				assignmentGeneration
			),
			{ assignmentGeneration }
		);
	}

	private async createJob<T extends JobType>(
		machine: Pick<Machine, 'id'>,
		type: T,
		resourceType: ResourceTypeForJobType<T>,
		resourceId: string,
		payload?: string,
		options?: CreateJobOptions
	): Promise<Job> {
		const job = await this.jobService.createJob(
			null,
			type,
			machine.id,
			resourceType,
			resourceId,
			payload,
			options
		);
		this.logger.debug(
			`Created ${job.type} job ${job.id} for ${job.resourceType} ${job.resourceId} on machine ${machine.id}`
		);
		return job;
	}

	private async activePlacement(
		machine: Pick<Machine, 'id'>,
		sandboxId: string
	): Promise<SandboxPlacement> {
		const placement = await this.entityManager.findOne(SandboxPlacement, {
			sandboxId,
			machineId: machine.id,
			releasedAt: null,
		});
		if (!placement) {
			throw new Error(
				`Sandbox ${sandboxId} has no active placement on Machine ${machine.id}`
			);
		}
		return placement;
	}
}
