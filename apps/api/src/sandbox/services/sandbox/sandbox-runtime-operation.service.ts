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
import { apiError } from '../../../common/utils/error/api-error.util';
import {
	type SandboxNetworkFields,
	sandboxNetworkPolicy,
	sandboxResources,
} from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../../organization/services/organization-quota.service';
import { getEffectivePerSandboxLimits } from '../../../organization/utils/sandbox-limits.util';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import { SecretService } from '../../../secrets/services/secret.service';
import { PAUSE_WITH_MANAGED_SECRETS_UNSUPPORTED } from '../../constants/sandbox.constants';
import { ResizeSandboxDto } from '../../dto/resize-sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import {
	assertOrganizationEgressBandwidth,
	networkSettingsUpdate,
} from '../../utils/runtime/sandbox-network-settings.util';
import { SandboxService } from './sandbox.service';
import { SandboxQuotaService } from './sandbox-quota.service';
import { SandboxRuntimeSpecService } from './sandbox-runtime-spec.service';

const STOPPED_RESIZE_QUOTA_DELTA = { cpu: 0, memory: 0, gpu: 0 } as const;
const NO_RESOURCE_CHANGES_MESSAGE =
	'The sandbox already has these resources. Change at least one value to resize it.';

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
				apiError(
					SandboxErrorCode.STATE_INVALID,
					'Only a started sandbox can be paused. Start the sandbox, then pause it.'
				)
			);
		}

		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}
		if (sandbox.gpu > 0) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.PAUSE_NOT_SUPPORTED,
					'GPU sandboxes cannot be paused. Stop the sandbox instead.'
				)
			);
		}
		if (
			await this.secretService.hasSandboxBindings(organizationId, sandbox.id)
		) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.PAUSE_NOT_SUPPORTED,
					PAUSE_WITH_MANAGED_SECRETS_UNSUPPORTED
				)
			);
		}

		if (!sandbox.machineId) {
			throw new NotFoundException(
				apiError(
					SandboxErrorCode.NOT_PLACED,
					`Sandbox ${sandbox.id} is not placed on a machine. Start the sandbox, then try again.`
				)
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
				throw new BadRequestException(
					apiError(
						SandboxErrorCode.NOT_PLACED,
						'The sandbox is not placed on a machine. Start the sandbox once, then resize it.'
					)
				);
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

		await this.quota.assertPerSandboxLimits({
			organizationId: sandbox.organizationId,
			sandboxClass: sandbox.sandboxClass,
			requested: {
				cpu: resources.cpu,
				memory: resources.mem,
				disk: resources.disk,
			},
			ephemeral: isEphemeral(sandbox),
			limits: getEffectivePerSandboxLimits(
				organizationLimits,
				quota,
				sandbox.gpu > 0
			),
		});

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
		assertOrganizationEgressBandwidth(
			(await this.organizationLimitsService.get(organizationId))
				.sandboxLimitedNetworkEgress,
			egressBandwidthBps
		);
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		if (sandbox.state !== SandboxState.STARTED) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.STATE_INVALID,
					'The network policy can only be changed while the sandbox is started. Start the sandbox, then try again.'
				)
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
				apiError(
					SandboxErrorCode.NETWORK_POLICY_INVALID,
					'Block-all and allow lists cannot be used together. Turn off block-all, or remove the allow lists.'
				)
			);
		}

		const updateData = networkSettingsUpdate(
			networkBlockAll,
			networkAllowList,
			domainAllowList,
			egressBandwidthBps
		);
		const abuseControls = {
			networkThrottleBandwidthBps: sandbox.networkThrottleBandwidthBps,
			networkThrottleConnectionsPerSecond:
				sandbox.networkThrottleConnectionsPerSecond,
			abuseEgressBlock: sandbox.abuseEgressBlock,
		} satisfies Partial<SandboxNetworkFields>;
		const effective: SandboxNetworkFields = {
			networkBlockAll: sandbox.networkBlockAll,
			networkAllowList: sandbox.networkAllowList,
			domainAllowList: sandbox.domainAllowList,
			egressBandwidthBps: sandbox.egressBandwidthBps,
			...abuseControls,
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
				...abuseControls,
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
			apiError(
				SandboxErrorCode.STATE_INVALID,
				'The sandbox must be stopped to change its resources. Stop the sandbox, then resize it.'
			)
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
		throw new BadRequestException(
			apiError(SandboxErrorCode.RESIZE_INVALID, NO_RESOURCE_CHANGES_MESSAGE)
		);
	}

	if (resizeDto.disk !== undefined && resizeDto.disk < sandbox.disk) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.RESIZE_INVALID,
				'The sandbox disk cannot shrink. Request a disk at least as large as the current one.'
			)
		);
	}

	const cpu = resizeDto.cpu ?? sandbox.cpu;
	const mem = resizeDto.memory ?? sandbox.mem;
	const disk = resizeDto.disk ?? sandbox.disk;

	if (cpu === sandbox.cpu && mem === sandbox.mem && disk === sandbox.disk) {
		throw new BadRequestException(
			apiError(SandboxErrorCode.RESIZE_INVALID, NO_RESOURCE_CHANGES_MESSAGE)
		);
	}

	return { cpu, mem, disk };
}
