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
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { OrganizationLimits } from '../../../../organization/tenant/entities/organization-limits.entity';
import { OrganizationService } from '../../../../organization/tenant/services/organization.service';
import { OrganizationLimitsService } from '../../../../organization/tenant/services/organization-limits.service';
import { inPlaceRecoveryIntent } from '../../../machine/utils/proto/sandbox-runtime-intent.util';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import {
	type PendingQuotaUsage,
	pendingQuotaUsage,
	sandboxQuotaUsage,
} from '../../../placement/utils/pending-quota-usage.util';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { isApiRecoverableError } from '../../constants/errors-for-recovery.constants';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxStartedEvent } from '../../events/sandbox-started.event';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { getStateChangeLockKey } from '../../utils/lock-key.util';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { SandboxService } from '../sandbox/sandbox.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';

const RECOVER_LOCK_TTL_SECONDS = 60;
const RECOVER_FROM_BACKUP_COOLDOWN_SECONDS = 60 * 60;
const RECOVER_FROM_BACKUP_COOLDOWN_MARKER = '1';

function recoverFromBackupCooldownKey(sandboxId: string): string {
	return `sandbox:recover-from-backup:${sandboxId}`;
}

@Injectable()
export class SandboxRecoveryService {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly organizations: OrganizationService,
		private readonly placements: SandboxPlacementResolverService,
		private readonly quota: SandboxQuotaService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly eventEmitter: EventEmitter2,
		@InjectRedis() private readonly redis: Redis
	) {}

	async recover(
		sandboxIdOrName: string,
		organizationId: string,
		skipStart = false
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		if (!sandbox.recoverable) {
			throw new BadRequestException('Sandbox is not in a recoverable state');
		}

		const ownMachinesOnly = await this.placements.runsOnOwnMachines(sandbox);

		const recovered = await this.redisLockProvider.runExclusive(
			getStateChangeLockKey(sandbox.id),
			RECOVER_LOCK_TTL_SECONDS,
			async () => {
				if (sandbox.state !== SandboxState.ERROR) {
					throw new BadRequestException(
						'Sandbox must be in error state to recover'
					);
				}

				await this.organizations.assertActive(organizationId);
				const organizationLimits =
					await this.organizationLimitsService.get(organizationId);

				if (
					isApiRecoverableError(sandbox.errorReason) &&
					sandbox.backupState === BackupState.COMPLETED &&
					sandbox.backupSnapshot &&
					sandbox.backupRegistryId
				) {
					return await this.recoverFromBackup(
						sandbox,
						organizationLimits,
						ownMachinesOnly
					);
				}

				return await this.recoverInPlace(
					sandbox,
					organizationLimits,
					ownMachinesOnly,
					skipStart
				);
			}
		);
		if (!recovered) throw new StateChangeInProgressException();
		return recovered;
	}

	private async recoverFromBackup(
		sandbox: Sandbox,
		organizationLimits: OrganizationLimits,
		ownMachinesOnly: boolean
	): Promise<Sandbox> {
		const cooldownKey = recoverFromBackupCooldownKey(sandbox.id);
		if (await this.redis.get(cooldownKey)) {
			throw new ConflictException(
				'Sandbox recovery has been attempted recently. Please try again later'
			);
		}

		const usage = sandboxQuotaUsage(sandbox);
		const reservation = await this.quota.validateOrganizationQuotas({
			organizationLimits,
			sandboxClass: sandbox.sandboxClass,
			usage,
			ephemeral: isEphemeral(sandbox),
			ownMachinesOnly,
			excludeSandboxId: sandbox.id,
		});
		const pending = pendingQuotaUsage(reservation, usage);

		try {
			const updatedSandbox = await this.sandboxRepository.updateWhere(
				sandbox.id,
				{
					updateData: {
						state: SandboxState.ARCHIVED,
						desiredState: SandboxDesiredState.STARTED,
						errorReason: null,
						recoverable: false,
						...(sandbox.machineId && { prevMachineId: sandbox.machineId }),
					},
					whereCondition: {
						recoverable: true,
						pending: false,
						state: SandboxState.ERROR,
					},
				}
			);

			await this.redis.set(
				cooldownKey,
				RECOVER_FROM_BACKUP_COOLDOWN_MARKER,
				'EX',
				RECOVER_FROM_BACKUP_COOLDOWN_SECONDS
			);

			this.eventEmitter.emit(
				SandboxEvents.STARTED,
				new SandboxStartedEvent(updatedSandbox)
			);

			return updatedSandbox;
		} catch (error) {
			await this.rollback(organizationLimits, sandbox, pending);
			throw error;
		}
	}

	private async recoverInPlace(
		sandbox: Sandbox,
		organizationLimits: OrganizationLimits,
		ownMachinesOnly: boolean,
		skipStart: boolean
	): Promise<Sandbox> {
		if (!sandbox.machineId || sandbox.runtimeLifecycle === null) {
			throw new NotFoundException(
				`Sandbox with ID ${sandbox.id} does not have a machine`
			);
		}
		const willStart = !skipStart;

		const reservation = await this.quota.validateOrganizationQuotas({
			organizationLimits,
			sandboxClass: sandbox.sandboxClass,
			usage: {
				cpu: willStart ? sandbox.cpu : 0,
				memory: willStart ? sandbox.mem : 0,
				disk: sandbox.disk,
				gpu: willStart ? sandbox.gpu : 0,
			},
			ephemeral: isEphemeral(sandbox),
			ownMachinesOnly,
			excludeSandboxId: sandbox.id,
		});
		const pending = pendingQuotaUsage(reservation, sandboxQuotaUsage(sandbox));

		try {
			return await this.sandboxRepository.updateWhere(sandbox.id, {
				updateData: {
					desiredState: skipStart
						? SandboxDesiredState.STOPPED
						: SandboxDesiredState.STARTED,
				},
				whereCondition: {
					state: SandboxState.ERROR,
					machineId: sandbox.machineId,
					specGeneration: sandbox.specGeneration,
				},
				runtimeIntent: inPlaceRecoveryIntent(sandbox),
			});
		} catch (error) {
			await this.rollback(organizationLimits, sandbox, pending);
			throw error;
		}
	}

	private rollback(
		organizationLimits: OrganizationLimits,
		sandbox: Sandbox,
		pending: PendingQuotaUsage
	): Promise<void> {
		return this.quota.rollbackPendingUsage(
			organizationLimits.organizationId,
			sandbox.sandboxClass,
			pending.cpu,
			pending.memory,
			pending.disk,
			pending.gpu
		);
	}
}
