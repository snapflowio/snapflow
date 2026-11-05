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
import { isValidUuid } from '../../../common/utils/uuid.util';
import type { OrganizationLimits } from '../../../organization/entities/organization-limits.entity';
import {
	applyPlacement,
	type ResolvedPlacement,
} from '../../../placement/utils/sandbox-placement.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { VolumeService } from '../../../volume/services/volume.service';
import { MINIMUM_EGRESS_BANDWIDTH_BPS } from '../../constants/network.constants';
import { CreateSandboxDto } from '../../dto/create-sandbox.dto';
import { SandboxVolume } from '../../dto/sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import {
	requireValidDomainAllowList,
	requireValidNetworkAllowList,
} from '../../utils/runtime/network-allow-list.util';
import { normalizeSandboxCapabilities } from '../../utils/runtime/sandbox-capabilities.util';
import {
	resolveAutoArchiveInterval,
	resolveAutoStopInterval,
	resolveModeAutoDeleteInterval,
	retentionArchiveMinutes,
} from '../../utils/runtime/sandbox-interval.util';
import { resolveSandboxRuntimeConfiguration } from '../../utils/runtime/sandbox-runtime-configuration.util';
import {
	validateMountPaths,
	validateSubpaths,
} from '../../utils/runtime/volume-mount-path-validation.util';
import { SandboxService } from '../sandbox/sandbox.service';

export type AdmittedSandboxShape = Pick<
	Sandbox,
	'sandboxClass' | 'cpu' | 'mem' | 'disk' | 'gpu'
>;

@Injectable()
export class SandboxAdmissionService {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly entityManager: EntityManager,
		private readonly volumeService: VolumeService,
		private readonly settings: SettingsService
	) {}

	async resolveLinkedSandbox(
		createSandboxDto: CreateSandboxDto,
		organizationId: string
	): Promise<Sandbox | undefined> {
		if (!createSandboxDto.linkedSandbox) {
			return undefined;
		}

		if (!isEphemeral(createSandboxDto)) {
			throw new BadRequestException('Linked sandboxes must use ephemeral mode');
		}

		const linkedSandbox = await this.sandboxService.findOneByIdOrName(
			createSandboxDto.linkedSandbox,
			organizationId
		);

		if (linkedSandbox.linkedSandboxId) {
			throw new BadRequestException(
				`Linked sandbox ${linkedSandbox.id} is itself linked to another sandbox; chained links are not allowed`
			);
		}

		const existingFollower = await this.entityManager.findOne(Sandbox, {
			linkedSandboxId: linkedSandbox.id,
			desiredState: { $ne: SandboxDesiredState.DESTROYED },
		});
		if (existingFollower) {
			throw new BadRequestException(
				`Linked sandbox ${linkedSandbox.id} is already paired with ${existingFollower.id}`
			);
		}

		if (
			linkedSandbox.state !== SandboxState.STARTED ||
			!linkedSandbox.machineId
		) {
			throw new BadRequestException(
				`Linked sandbox must be STARTED with an assigned machine (current: ${linkedSandbox.state})`
			);
		}

		return linkedSandbox;
	}

	async resolveVolumes(
		organizationId: string,
		volumes?: SandboxVolume[]
	): Promise<SandboxVolume[] | undefined> {
		if (volumes === undefined || volumes.length === 0) {
			return volumes;
		}

		const foundVolumes = await this.volumeService.getVolumesByIdOrName(
			organizationId,
			volumes.map((volume) => volume.volumeId)
		);

		const resolved = volumes.map((volume) => {
			const matchedVolume = foundVolumes.get(volume.volumeId);
			if (matchedVolume === undefined || !isValidUuid(matchedVolume.id)) {
				throw new BadRequestException(
					`Volume '${volume.volumeId}' could not be resolved to a valid volume ID`
				);
			}
			return { ...volume, volumeId: matchedVolume.id };
		});

		validateVolumeConfiguration(
			() => validateMountPaths(resolved),
			'Invalid volume mount configuration'
		);
		validateVolumeConfiguration(
			() => validateSubpaths(resolved),
			'Invalid volume subpath configuration'
		);

		return resolved;
	}

	async newSandbox(
		createSandboxDto: CreateSandboxDto,
		organizationLimits: Pick<
			OrganizationLimits,
			'organizationId' | 'sandboxLimitedNetworkEgress'
		>,
		placement: Pick<ResolvedPlacement, 'request'>,
		shape: AdmittedSandboxShape,
		volumes: SandboxVolume[] | undefined
	): Promise<Sandbox> {
		const runtimeConfiguration =
			resolveSandboxRuntimeConfiguration(createSandboxDto);
		const sandbox = new Sandbox({ name: createSandboxDto.name });
		sandbox.organizationId = organizationLimits.organizationId;
		sandbox.sandboxClass = shape.sandboxClass;
		sandbox.mode = createSandboxDto.mode;
		sandbox.capabilities = normalizeSandboxCapabilities(
			createSandboxDto.capabilities
		);
		sandbox.osUser = runtimeConfiguration.osUser;
		sandbox.env = runtimeConfiguration.env;
		sandbox.labels = createSandboxDto.labels || {};
		sandbox.cpu = shape.cpu;
		sandbox.gpu = shape.gpu;
		sandbox.mem = shape.mem;
		sandbox.disk = shape.disk;
		applyPlacement(sandbox, placement);
		applyNetworkPolicy(sandbox, createSandboxDto, organizationLimits);
		await this.applyIdleIntervals(sandbox, createSandboxDto);
		if (volumes !== undefined) {
			sandbox.volumes = volumes;
		}
		return sandbox;
	}

	private async applyIdleIntervals(
		sandbox: Sandbox,
		createSandboxDto: CreateSandboxDto
	): Promise<void> {
		if (createSandboxDto.autoStopInterval !== undefined) {
			sandbox.autoStopInterval = resolveAutoStopInterval(
				createSandboxDto.autoStopInterval
			);
		}
		if (createSandboxDto.autoArchiveInterval !== undefined) {
			sandbox.autoArchiveInterval = resolveAutoArchiveInterval(
				createSandboxDto.autoArchiveInterval,
				retentionArchiveMinutes(await this.settings.get())
			);
		}
		sandbox.autoDeleteInterval = resolveModeAutoDeleteInterval(
			sandbox.mode,
			createSandboxDto.autoDeleteInterval
		);
	}
}

function applyNetworkPolicy(
	sandbox: Sandbox,
	createSandboxDto: CreateSandboxDto,
	organizationLimits: Pick<OrganizationLimits, 'sandboxLimitedNetworkEgress'>
): void {
	if (createSandboxDto.networkBlockAll !== undefined) {
		sandbox.networkBlockAll = createSandboxDto.networkBlockAll;
	}
	if (createSandboxDto.networkAllowList !== undefined) {
		sandbox.networkAllowList = requireValidNetworkAllowList(
			createSandboxDto.networkAllowList
		);
	}
	if (createSandboxDto.domainAllowList !== undefined) {
		sandbox.domainAllowList = requireValidDomainAllowList(
			createSandboxDto.domainAllowList
		);
	}
	sandbox.egressBandwidthBps =
		createSandboxDto.egressBandwidthBps ??
		(organizationLimits.sandboxLimitedNetworkEgress
			? MINIMUM_EGRESS_BANDWIDTH_BPS
			: null);
}

function validateVolumeConfiguration(
	validate: () => void,
	fallbackMessage: string
): void {
	try {
		validate();
	} catch (error) {
		throw new BadRequestException(
			error instanceof Error ? error.message : fallbackMessage
		);
	}
}
