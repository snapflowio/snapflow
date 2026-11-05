/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create } from '@bufbuild/protobuf';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
	SandboxBackupSourceSchema,
	SandboxForkSourceSchema,
	SandboxImageSchema,
	SandboxLifecycle,
	type SandboxSpec,
} from '@snapflow/machine-proto';
import { entrypointFromDockerfile } from '../../../common/utils/dockerfile.util';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import type { SandboxRuntimeIntent } from '../../../machine/utils/proto/sandbox-runtime-intent.util';
import {
	buildSandboxSpec,
	decodeSandboxSpec,
	type FencedVolume,
	type SandboxSpecSource,
} from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { SnapshotService } from '../../../snapshot/services/snapshot.service';
import { VolumeAttachmentService } from '../../../volume/services/volume-attachment.service';
import { Sandbox } from '../../entities/sandbox.entity';

const SANDBOX_NAME_LABEL = 'sandboxName';
const SANDBOX_OWNER_LABEL = 'organizationId';

const NO_FENCED_VOLUMES: ReadonlyMap<string, FencedVolume> = new Map();

interface ResolvedImage {
	ref: string;
	entrypoint: string[];
	registryId: string | null;
}

@Injectable()
export class SandboxRuntimeSpecService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotService: SnapshotService,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly volumeAttachmentService: VolumeAttachmentService
	) {}

	async imageIntent(
		sandbox: Sandbox,
		machineId: string
	): Promise<SandboxRuntimeIntent> {
		const image = await this.resolveImage(sandbox);
		return {
			lifecycle: SandboxLifecycle.STARTED,
			spec: await this.buildSpec(sandbox, machineId, {
				case: 'image',
				value: create(SandboxImageSchema, {
					ref: image.ref,
					entrypoint: image.entrypoint,
				}),
			}),
			registryId: image.registryId,
		};
	}

	async backupIntent(
		sandbox: Sandbox,
		machineId: string,
		lifecycle: SandboxLifecycle
	): Promise<SandboxRuntimeIntent> {
		if (!sandbox.backupSnapshot || !sandbox.backupRegistryId) {
			throw new Error(`Sandbox ${sandbox.id} has no completed backup artifact`);
		}
		const registry = await this.dockerRegistryService.findOne(
			sandbox.backupRegistryId
		);
		if (!registry) {
			throw new Error(
				`Registry ${sandbox.backupRegistryId} not found for sandbox ${sandbox.id}`
			);
		}
		return {
			lifecycle,
			spec: await this.buildSpec(sandbox, machineId, {
				case: 'backup',
				value: create(SandboxBackupSourceSchema, {
					ref: sandbox.backupSnapshot,
				}),
			}),
			registryId: registry.id,
		};
	}

	async forkIntent(
		sandbox: Sandbox,
		sourceSandboxId: string
	): Promise<SandboxRuntimeIntent> {
		return {
			lifecycle: SandboxLifecycle.STARTED,
			spec: buildSandboxSpec({
				sandbox: { ...sandbox, volumes: [] },
				source: {
					case: 'fork',
					value: create(SandboxForkSourceSchema, { sourceSandboxId }),
				},
				fencedVolumes: NO_FENCED_VOLUMES,
				labels: {
					[SANDBOX_OWNER_LABEL]: sandbox.organizationId,
					[SANDBOX_NAME_LABEL]: sandbox.name,
				},
			}),
			registryId: null,
		};
	}

	async patchedSpec(
		sandbox: Sandbox,
		patch: (spec: SandboxSpec) => void
	): Promise<SandboxSpec> {
		await this.entityManager.populate(sandbox, ['runtimeSpec']);
		if (!sandbox.runtimeSpec) {
			throw new Error(`Sandbox ${sandbox.id} has no runtime spec`);
		}
		const spec = decodeSandboxSpec(sandbox.runtimeSpec);
		patch(spec);
		return spec;
	}

	private async buildSpec(
		sandbox: Sandbox,
		machineId: string,
		source: SandboxSpecSource
	): Promise<SandboxSpec> {
		const fencedVolumes = await this.volumeAttachmentService.claimAttachments(
			sandbox.id,
			machineId,
			sandbox.volumes.map((volume) => volume.volumeId)
		);
		return buildSandboxSpec({
			sandbox,
			source,
			fencedVolumes,
			labels: {
				[SANDBOX_OWNER_LABEL]: sandbox.organizationId,
				[SANDBOX_NAME_LABEL]: sandbox.name,
			},
		});
	}

	private async resolveImage(sandbox: Sandbox): Promise<ResolvedImage> {
		if (sandbox.buildInfo) {
			if (!sandbox.buildInfo.dockerfileContent) {
				throw new Error(
					`Build ${sandbox.buildInfo.snapshotRef} has no Dockerfile content`
				);
			}
			return {
				ref: sandbox.buildInfo.snapshotRef,
				entrypoint: entrypointFromDockerfile(
					sandbox.buildInfo.dockerfileContent
				),
				registryId: null,
			};
		}
		if (!sandbox.snapshot) {
			throw new Error(`Sandbox ${sandbox.id} has no source snapshot`);
		}
		const snapshot = await this.snapshotService.getSnapshotByName(
			sandbox.snapshot,
			sandbox.organizationId
		);
		if (!snapshot.ref) {
			throw new Error(`Snapshot ${snapshot.id} has not been published`);
		}
		const registry =
			await this.dockerRegistryService.findInternalRegistryBySnapshotRef(
				snapshot.ref
			);
		if (!registry) {
			throw new Error(
				`No internal registry found for snapshot ${snapshot.ref}`
			);
		}
		return {
			ref: snapshot.ref,
			entrypoint: snapshot.entrypoint ?? [],
			registryId: registry.id,
		};
	}
}
