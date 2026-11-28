/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../../common/utils/error/error.util';
import { ImageReference } from '../../../common/values/image-reference.value';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { registryRepositoryPrefix } from '../../../docker-registry/utils/docker-registry-url.util';
import { OCI_DIGEST_PREFIX } from '../../../machine/constants/machine-snapshot.constants';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineJobDispatchService } from '../../../machine-job/services/machine-job-dispatch.service';
import { Snapshot } from '../../entities/snapshot.entity';
import { SnapshotState } from '../../enums/snapshot-state.enum';
import { SnapshotRepository } from '../../repositories/snapshot.repository';

const SNAPSHOT_IMAGE_PREFIX = 'snapflow-';
const SNAPSHOT_IMAGE_TAG = 'snapflow';
const CONTENT_ADDRESSED_REF = new RegExp(
	`/${SNAPSHOT_IMAGE_PREFIX}([a-f0-9]{64}):${SNAPSHOT_IMAGE_TAG}$`
);

function digestMismatch(ref: Snapshot['ref'], hash: string): boolean {
	const named = ref ? CONTENT_ADDRESSED_REF.exec(ref)?.[1] : undefined;
	return named !== undefined && named !== hash;
}

interface PublishedImage {
	hash: string;
	sizeGB: number;
	entrypoint?: string[];
}

@Injectable()
export class SnapshotPublicationService {
	private readonly logger = new Logger(SnapshotPublicationService.name);

	constructor(
		private readonly snapshotRepository: SnapshotRepository,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly machineJobDispatch: MachineJobDispatchService
	) {}

	async inspect(snapshot: Snapshot, machine: Machine): Promise<boolean> {
		const registry = await this.dockerRegistryService.findRegistryByImageName(
			snapshot.imageName,
			snapshot.organizationId ?? undefined
		);
		const internalRegistry =
			this.dockerRegistryService.getAvailableInternalRegistry();
		const inspected = await this.machineJobDispatch.inspectSnapshotInRegistry(
			machine,
			ImageReference.parse(snapshot.imageName).toString(),
			registry ?? undefined
		);
		return this.record(snapshot, inspected, {
			ref: `${registryRepositoryPrefix(internalRegistry)}/${SNAPSHOT_IMAGE_PREFIX}${inspected.hash}:${SNAPSHOT_IMAGE_TAG}`,
		});
	}

	async publish(snapshot: Snapshot, machine: Machine): Promise<void> {
		if (!snapshot.ref) {
			throw new Error(`Snapshot ${snapshot.id} has no published reference`);
		}
		const sourceRef = snapshot.imageName.trim() || snapshot.ref;
		const sourceRegistry =
			(await this.dockerRegistryService.findSourceRegistryBySnapshotImageName(
				sourceRef,
				snapshot.organizationId ?? undefined
			)) ?? (await this.dockerRegistryService.getDefaultDockerHubRegistry());
		await this.machineJobDispatch.publishSnapshot(
			machine,
			sourceRef,
			sourceRegistry ?? undefined,
			snapshot.ref,
			this.dockerRegistryService.getAvailableInternalRegistry()
		);
	}

	async build(snapshot: Snapshot, machine: Machine): Promise<void> {
		const organizationId = snapshot.organizationId;
		const dockerfileContent = snapshot.buildInfo?.dockerfileContent;
		if (!organizationId || !snapshot.buildInfo || !dockerfileContent) {
			throw new Error(`Snapshot ${snapshot.id} has no build definition`);
		}
		const sourceRegistries =
			await this.dockerRegistryService.getSourceRegistriesForDockerfile(
				dockerfileContent,
				organizationId
			);
		await this.machineJobDispatch.buildSnapshot(
			machine,
			snapshot.buildInfo,
			organizationId,
			this.dockerRegistryService.getBuildCacheRegistry(organizationId),
			sourceRegistries.length > 0 ? sourceRegistries : undefined,
			this.dockerRegistryService.getAvailableInternalRegistry(),
			true
		);
	}

	async recordPublishedImage(
		snapshot: Snapshot,
		image: PublishedImage
	): Promise<boolean> {
		const recorded = await this.record(snapshot, image, {
			digest: `${OCI_DIGEST_PREFIX}${image.hash}`,
		});
		if (recorded && !snapshot.buildInfo) {
			await this.releasePushedSource(snapshot);
		}
		return recorded;
	}

	private async record(
		snapshot: Snapshot,
		image: PublishedImage,
		identity: Pick<Partial<Snapshot>, 'ref' | 'digest'>
	): Promise<boolean> {
		if (identity.digest && digestMismatch(snapshot.ref, image.hash)) {
			await this.snapshotRepository.update(snapshot.id, {
				updateData: {
					state: SnapshotState.ERROR,
					errorReason:
						'The published image does not match the inspected image; create the snapshot again',
				},
				entity: snapshot,
			});
			this.logger.warn(
				`Snapshot ${snapshot.id} was published as ${image.hash}, not as ${snapshot.ref}`
			);
			return false;
		}
		const updateData: Partial<Snapshot> = {
			...(identity.digest && { digest: identity.digest }),
			...(!snapshot.ref && identity.ref && { ref: identity.ref }),
			...(!snapshot.entrypoint?.length &&
				image.entrypoint?.length && { entrypoint: image.entrypoint }),
		};
		if (snapshot.size == null && snapshot.organizationId) {
			updateData.size = image.sizeGB;
		}
		if (Object.keys(updateData).length > 0) {
			await this.snapshotRepository.update(snapshot.id, {
				updateData,
				entity: snapshot,
			});
		}
		return updateData.state !== SnapshotState.ERROR;
	}

	private async releasePushedSource(snapshot: Snapshot): Promise<void> {
		if (!snapshot.organizationId) return;
		try {
			const pushRegistry = this.dockerRegistryService.findPushedImageRegistry(
				snapshot.imageName,
				snapshot.organizationId
			);
			if (pushRegistry) {
				await this.dockerRegistryService.deleteImageFromRegistry(
					snapshot.imageName,
					pushRegistry
				);
			}
		} catch (error) {
			this.logger.error(
				`Failed to remove pushed image ${snapshot.imageName}: ${errorMessage(error)}`
			);
		}
	}
}
