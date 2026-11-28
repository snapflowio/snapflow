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
import { apiError } from '../../../common/utils/error/api-error.util';
import { isValidUuid } from '../../../common/utils/uuid.util';
import type { OrganizationLimits } from '../../../organization/entities/organization-limits.entity';
import {
	applyPlacement,
	type ResolvedPlacement,
} from '../../../placement/utils/sandbox-placement.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { AutomaticPaymentsService } from '../../../settlement/services/vouchers/automatic-payments.service';
import { VolumeErrorCode } from '../../../volume/enums/volume-error-code.enum';
import { VolumeService } from '../../../volume/services/volume.service';
import { MINIMUM_EGRESS_BANDWIDTH_BPS } from '../../constants/network.constants';
import { CreateSandboxDto } from '../../dto/create-sandbox.dto';
import { SandboxVolume } from '../../dto/sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
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
} from '../../utils/runtime/sandbox-interval.util';
import { assertOrganizationEgressBandwidth } from '../../utils/runtime/sandbox-network-settings.util';
import { resolveSandboxRuntimeConfiguration } from '../../utils/runtime/sandbox-runtime-configuration.util';
import {
	validateMountPaths,
	validateSubpaths,
} from '../../utils/runtime/volume-mount-path-validation.util';
import { requireCustomerLabels } from '../../utils/sandbox-labels.util';
import { SandboxService } from '../sandbox/sandbox.service';

type AdmittedSandboxShape = Pick<
	Sandbox,
	'sandboxClass' | 'cpu' | 'mem' | 'disk' | 'gpu'
>;

@Injectable()
export class SandboxAdmissionService {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly entityManager: EntityManager,
		private readonly volumeService: VolumeService,
		private readonly settings: SettingsService,
		private readonly automaticPayments: AutomaticPaymentsService
	) {}

	async resolveLinkedSandbox(
		createSandboxDto: CreateSandboxDto,
		organizationId: string
	): Promise<Sandbox | undefined> {
		if (!createSandboxDto.linkedSandbox) {
			return undefined;
		}

		if (!isEphemeral(createSandboxDto)) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.MODE_INVALID,
					'A sandbox with linkedSandbox must use ephemeral mode. Set the mode to ephemeral.'
				)
			);
		}

		const linkedSandbox = await this.sandboxService.findOneByIdOrName(
			createSandboxDto.linkedSandbox,
			organizationId
		);

		if (linkedSandbox.linkedSandboxId) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.LINK_INVALID,
					`Sandbox ${linkedSandbox.id} is itself linked to another sandbox. Link to a sandbox that is not linked.`
				)
			);
		}

		const existingFollower = await this.entityManager.findOne(Sandbox, {
			linkedSandboxId: linkedSandbox.id,
			desiredState: { $ne: SandboxDesiredState.DESTROYED },
		});
		if (existingFollower) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.LINK_INVALID,
					`Sandbox ${linkedSandbox.id} is already linked with sandbox ${existingFollower.id}. Choose another sandbox to link.`
				)
			);
		}

		if (
			linkedSandbox.state !== SandboxState.STARTED ||
			!linkedSandbox.machineId
		) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.LINK_INVALID,
					`The linked sandbox must be started (it is ${linkedSandbox.state}). Start it, then try again.`
				)
			);
		}

		return linkedSandbox;
	}

	async assertPaymentsSignable(
		sandbox: Pick<Sandbox, 'organizationId' | 'voucherSigning'>,
		ownMachinesOnly: boolean
	): Promise<void> {
		if (ownMachinesOnly) return;
		await this.automaticPayments.assertSignable(
			sandbox.organizationId,
			sandbox.voucherSigning
		);
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
					apiError(
						VolumeErrorCode.NOT_FOUND,
						`Volume ${volume.volumeId} was not found. Check the volume ID or name.`
					)
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
		sandbox.labels = requireCustomerLabels(createSandboxDto.labels ?? {});
		sandbox.cpu = shape.cpu;
		sandbox.gpu = shape.gpu;
		sandbox.mem = shape.mem;
		sandbox.disk = shape.disk;
		applyPlacement(sandbox, placement);
		if (createSandboxDto.voucherSigning !== undefined) {
			sandbox.voucherSigning = createSandboxDto.voucherSigning;
		}
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
				createSandboxDto.autoArchiveInterval
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
	assertOrganizationEgressBandwidth(
		organizationLimits.sandboxLimitedNetworkEgress,
		createSandboxDto.egressBandwidthBps
	);
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
			apiError(
				SandboxErrorCode.VOLUME_CONFIG_INVALID,
				error instanceof Error ? error.message : fallbackMessage
			),
			{ cause: error }
		);
	}
}
