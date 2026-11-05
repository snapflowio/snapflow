/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../../organization/services/organization-quota.service';
import { getEffectivePerSandboxLimits } from '../../../organization/utils/sandbox-limits.util';
import { SecretService } from '../../../secrets/services/secret.service';
import { PER_SANDBOX_LIMIT_MESSAGE } from '../../constants/resource-limit-messages.constants';
import { PAUSE_WITH_MANAGED_SECRETS_UNSUPPORTED } from '../../constants/sandbox.constants';
import { ResizeSandboxDto } from '../../dto/resize-sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import {
	type SandboxNetworkFields,
	sandboxNetworkPolicy,
	sandboxResources,
} from '../../machine/utils/proto/sandbox-runtime-spec.util';
import { SandboxPlacementResolverService } from '../../placement/services/sandbox-placement-resolver.service';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { networkSettingsUpdate } from '../../utils/runtime/sandbox-network-settings.util';
import { SandboxService } from './sandbox.service';
import { SandboxQuotaService } from './sandbox-quota.service';
import { SandboxRuntimeSpecService } from './sandbox-runtime-spec.service';

const STOPPED_RESIZE_QUOTA_DELTA = { cpu: 0, memory: 0, gpu: 0 } as const;
const NON_EPHEMERAL_SANDBOXES_FORBIDDEN = 0;
const NO_RESOURCE_CHANGES_MESSAGE =
	'No resource changes specified - sandbox is already at the desired configuration';

type ResizedResources = Pick<Sandbox, 'cpu' | 'mem' | 'disk'>;

@Injectable()
export class SandboxRuntimeOperationService {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly quotas: OrganizationQuotaService,
		private readonly organizations: OrganizationService,
		private readonly placements: SandboxPlacementResolverService,
		private readonly secretService: SecretService,
		private readonly quota: SandboxQuotaService,
		private readonly runtimeSpecs: SandboxRuntimeSpecService
	) {}

	async pause(
		sandboxIdOrName: string,
		organizationId: string
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		if (sandbox.state !== SandboxState.STARTED) {
			throw new BadRequestException(
				'Sandbox must be in started state to pause'
			);
		}

		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}
		if (sandbox.gpu > 0) {
			throw new BadRequestException('GPU sandboxes cannot be paused');
		}
		if (
			await this.secretService.hasSandboxBindings(organizationId, sandbox.id)
		) {
			throw new BadRequestException(PAUSE_WITH_MANAGED_SECRETS_UNSUPPORTED);
		}

		if (!sandbox.machineId) {
			throw new NotFoundException(
				`Sandbox with ID ${sandbox.id} does not have a machine`
			);
		}

		return this.sandboxRepository.updateWhere(sandbox.id, {
			updateData: {
				state: SandboxState.PAUSING,
				desiredState: SandboxDesiredState.PAUSED,
				pending: true,
			},
			whereCondition: {
				state: SandboxState.STARTED,
				pending: false,
			},
			runtimeIntent: { lifecycle: SandboxLifecycle.PAUSED },
		});
	}

	async resize(
		sandboxIdOrName: string,
		resizeDto: ResizeSandboxDto,
		organizationId: string
	): Promise<Sandbox> {
		let pendingDiskIncrement: number | undefined;

		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		try {
			const resources = resizedResources(sandbox, resizeDto);
			pendingDiskIncrement = await this.reserveResize(sandbox, resources);

			if (!sandbox.machineId || sandbox.runtimeLifecycle === null) {
				throw new BadRequestException('Sandbox has no machine assigned');
			}

			const spec = await this.runtimeSpecs.patchedSpec(sandbox, (current) => {
				current.resources = sandboxResources({
					cpu: resources.cpu,
					mem: resources.mem,
					disk: resources.disk,
					gpu: sandbox.gpu,
				});
			});
			return await this.sandboxRepository.updateWhere(sandbox.id, {
				updateData: { state: SandboxState.RESIZING },
				whereCondition: {
					pending: false,
					state: SandboxState.STOPPED,
					specGeneration: sandbox.specGeneration,
				},
				runtimeIntent: { lifecycle: SandboxLifecycle.STOPPED, spec },
			});
		} catch (error) {
			await this.quota.rollbackPendingUsage(
				organizationId,
				sandbox.sandboxClass,
				undefined,
				undefined,
				pendingDiskIncrement
			);
			throw error;
		}
	}

	private async reserveResize(
		sandbox: Sandbox,
		resources: ResizedResources
	): Promise<number | undefined> {
		await this.organizations.assertActive(sandbox.organizationId);
		const organizationLimits = await this.organizationLimitsService.get(
			sandbox.organizationId
		);

		const ownMachinesOnly = await this.placements.runsOnOwnMachines(sandbox);
		const quota = ownMachinesOnly
			? null
			: await this.quotas.find(sandbox.organizationId, sandbox.sandboxClass);

		assertWithinPerSandboxLimits(
			sandbox,
			resources,
			getEffectivePerSandboxLimits(organizationLimits, quota, sandbox.gpu > 0)
		);

		const diskDelta = resources.disk - sandbox.disk;
		if (diskDelta === 0) {
			return undefined;
		}
		const { pendingDiskIncremented } =
			await this.quota.validateOrganizationQuotas({
				organizationLimits,
				sandboxClass: sandbox.sandboxClass,
				usage: { ...STOPPED_RESIZE_QUOTA_DELTA, disk: diskDelta },
				ephemeral: isEphemeral(sandbox),
				ownMachinesOnly,
				quota,
				gpuEnabled: sandbox.gpu > 0,
			});
		return pendingDiskIncremented ? diskDelta : undefined;
	}

	async updateNetworkSettings(
		sandboxIdOrName: string,
		organizationId: string,
		networkBlockAll?: boolean,
		networkAllowList?: string,
		domainAllowList?: string,
		egressBandwidthBps?: number | null
	): Promise<Sandbox> {
		if (
			(await this.organizationLimitsService.get(organizationId))
				.sandboxLimitedNetworkEgress
		) {
			throw new BadRequestException(
				'Organization network policy restricts egress and cannot be overridden at the sandbox level'
			);
		}
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		if (sandbox.state !== SandboxState.STARTED) {
			throw new BadRequestException(
				'Sandbox must be started to update its network policy'
			);
		}
		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}
		if (
			networkBlockAll === true &&
			(networkAllowList?.trim() || domainAllowList?.trim())
		) {
			throw new BadRequestException(
				'Network block-all and allow lists cannot be enabled together'
			);
		}

		const updateData = networkSettingsUpdate(
			networkBlockAll,
			networkAllowList,
			domainAllowList,
			egressBandwidthBps
		);
		const effective: SandboxNetworkFields = {
			networkBlockAll: sandbox.networkBlockAll,
			networkAllowList: sandbox.networkAllowList,
			domainAllowList: sandbox.domainAllowList,
			egressBandwidthBps: sandbox.egressBandwidthBps,
			networkThrottleBandwidthBps: sandbox.networkThrottleBandwidthBps,
			...updateData,
		};
		const spec = await this.runtimeSpecs.patchedSpec(sandbox, (current) => {
			current.network = sandboxNetworkPolicy(effective);
		});
		return this.sandboxRepository.updateWhere(sandbox.id, {
			updateData,
			whereCondition: {
				state: SandboxState.STARTED,
				pending: false,
				specGeneration: sandbox.specGeneration,
			},
			runtimeIntent: { lifecycle: SandboxLifecycle.STARTED, spec },
		});
	}

	async applyNetworkThrottle(
		sandboxId: string,
		networkThrottleBandwidthBps: number | null
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOne(sandboxId);
		if (
			sandbox.state !== SandboxState.STARTED ||
			sandbox.pending ||
			sandbox.networkThrottleBandwidthBps === networkThrottleBandwidthBps
		) {
			return sandbox;
		}
		const spec = await this.runtimeSpecs.patchedSpec(sandbox, (current) => {
			current.network = sandboxNetworkPolicy({
				...sandbox,
				networkThrottleBandwidthBps,
			});
		});
		return this.sandboxRepository.updateWhere(sandbox.id, {
			updateData: { networkThrottleBandwidthBps },
			whereCondition: {
				state: SandboxState.STARTED,
				pending: false,
				specGeneration: sandbox.specGeneration,
			},
			runtimeIntent: { lifecycle: SandboxLifecycle.STARTED, spec },
		});
	}
}

function resizedResources(
	sandbox: Sandbox,
	resizeDto: ResizeSandboxDto
): ResizedResources {
	if (sandbox.state !== SandboxState.STOPPED) {
		throw new BadRequestException(
			'Sandbox must be stopped to resize microVM resources'
		);
	}

	if (sandbox.pending) {
		throw new StateChangeInProgressException();
	}

	if (
		resizeDto.cpu === undefined &&
		resizeDto.memory === undefined &&
		resizeDto.disk === undefined
	) {
		throw new BadRequestException(NO_RESOURCE_CHANGES_MESSAGE);
	}

	if (resizeDto.disk !== undefined && resizeDto.disk < sandbox.disk) {
		throw new BadRequestException('Sandbox disk size cannot be decreased');
	}

	const cpu = resizeDto.cpu ?? sandbox.cpu;
	const mem = resizeDto.memory ?? sandbox.mem;
	const disk = resizeDto.disk ?? sandbox.disk;

	if (cpu === sandbox.cpu && mem === sandbox.mem && disk === sandbox.disk) {
		throw new BadRequestException(NO_RESOURCE_CHANGES_MESSAGE);
	}

	return { cpu, mem, disk };
}

function assertWithinPerSandboxLimits(
	sandbox: Sandbox,
	{ cpu, mem, disk }: ResizedResources,
	limits: ReturnType<typeof getEffectivePerSandboxLimits>
): void {
	const {
		maxCpuPerSandbox,
		maxMemoryPerSandbox,
		maxDiskPerSandbox,
		maxDiskPerNonEphemeralSandbox,
	} = limits;

	if (cpu > maxCpuPerSandbox) {
		throw new BadRequestException(
			`CPU request ${cpu} exceeds maximum allowed per sandbox (${maxCpuPerSandbox}).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}
	if (mem > maxMemoryPerSandbox) {
		throw new BadRequestException(
			`Memory request ${mem}GB exceeds maximum allowed per sandbox (${maxMemoryPerSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}
	if (disk > maxDiskPerSandbox) {
		throw new BadRequestException(
			`Disk request ${disk}GB exceeds maximum allowed per sandbox (${maxDiskPerSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}

	if (isEphemeral(sandbox) || maxDiskPerNonEphemeralSandbox === null) {
		return;
	}
	if (maxDiskPerNonEphemeralSandbox === NON_EPHEMERAL_SANDBOXES_FORBIDDEN) {
		throw new BadRequestException(
			'Non-ephemeral sandboxes are not permitted for this organization'
		);
	}
	if (disk > maxDiskPerNonEphemeralSandbox) {
		throw new BadRequestException(
			`Disk request ${disk}GB exceeds maximum allowed per non-ephemeral sandbox (${maxDiskPerNonEphemeralSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}
}
