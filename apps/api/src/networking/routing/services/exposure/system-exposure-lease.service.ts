/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { PlacementBillingAuthorizationService } from '../../../../billing/ledger/services/placement/placement-billing-authorization.service';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { addSeconds } from '../../../../common/utils/time.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { Sandbox } from '../../../../sandbox/instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../../../sandbox/instance/entities/sandbox-placement.entity';
import { SandboxService } from '../../../../sandbox/instance/services/sandbox/sandbox.service';
import { Machine } from '../../../../sandbox/machine/entities/machine.entity';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	EXPOSURE_OBSERVED_STATE,
	SYSTEM_EXPOSURE_LEASE,
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../../constants/exposure.constants';
import type { ExposureDto } from '../../dto/exposure.dto';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { toExposureDto } from '../../utils/exposure/exposure-dto.util';
import { systemExposureNeedsRuntime } from '../../utils/exposure/exposure-serving-placement.util';
import {
	lockExposures,
	lockExposuresWhere,
} from '../../utils/network-lock.util';
import { ExposureReconciliationQueueService } from './exposure-reconciliation-queue.service';

@Injectable()
export class SystemExposureLeaseService {
	private readonly logger = new Logger(SystemExposureLeaseService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxes: SandboxService,
		private readonly billingAuthorizations: PlacementBillingAuthorizationService,
		private readonly exposureQueue: ExposureReconciliationQueueService
	) {}

	async request(
		organizationId: string,
		sandboxId: string,
		service: SystemExposureService,
		durationSeconds = SYSTEM_EXPOSURE_LEASE.defaultDurationSeconds,
		entityManager?: EntityManager
	): Promise<ExposureDto> {
		if (
			!Number.isInteger(durationSeconds) ||
			durationSeconds < SYSTEM_EXPOSURE_LEASE.minimumDurationSeconds ||
			durationSeconds > SYSTEM_EXPOSURE_LEASE.maximumDurationSeconds
		) {
			throw new BadRequestException(
				`System exposure duration must be an integer from ${SYSTEM_EXPOSURE_LEASE.minimumDurationSeconds} through ${SYSTEM_EXPOSURE_LEASE.maximumDurationSeconds} seconds`
			);
		}
		const sandbox = await this.sandboxes.findOneByIdOrName(
			sandboxId,
			organizationId,
			false,
			entityManager
		);
		const persist = (manager: EntityManager) =>
			this.extend(manager, sandbox, service, durationSeconds);
		return entityManager
			? persist(entityManager)
			: this.entityManager.transactional(persist, {
					propagation: TransactionPropagation.REQUIRED,
				});
	}

	private async extend(
		manager: EntityManager,
		sandbox: Sandbox,
		service: SystemExposureService,
		durationSeconds: number
	): Promise<ExposureDto> {
		const [exposure] = await lockExposuresWhere(manager, {
			organizationId: sandbox.organizationId,
			sandboxId: sandbox.id,
			kind: EXPOSURE_KIND.SYSTEM,
			systemService: service,
		});
		if (!exposure) throw new NotFoundException('System exposure not found');
		if (systemExposureNeedsRuntime(service)) {
			await this.billingAuthorizations.renewForSandbox(manager, sandbox);
		}
		const targetReference = await this.resolveTargetReference(
			manager,
			sandbox,
			service
		);
		if (service === SYSTEM_EXPOSURE_SERVICE.SSH) {
			await this.assertSshCapable(manager, sandbox);
		}
		const observedAt = await databaseNow(manager);
		const requestedUntil = addSeconds(observedAt, durationSeconds);
		const needsReconciliation =
			exposure.desiredState !== EXPOSURE_DESIRED_STATE.ACTIVE ||
			exposure.targetReference !== targetReference;
		if (needsReconciliation) {
			exposure.desiredState = EXPOSURE_DESIRED_STATE.ACTIVE;
			exposure.observedState = EXPOSURE_OBSERVED_STATE.PENDING;
			exposure.generation += 1;
			exposure.lastError = null;
		}
		exposure.targetReference = targetReference;
		if (
			!exposure.systemRequestedUntil ||
			exposure.systemRequestedUntil < requestedUntil
		) {
			exposure.systemRequestedUntil = requestedUntil;
		}
		if (needsReconciliation) {
			await this.exposureQueue.enqueue(
				manager,
				exposure.id,
				exposure.generation
			);
		} else {
			await this.refreshMaterialization(manager, exposure, observedAt);
		}
		return toExposureDto(exposure);
	}

	private async resolveTargetReference(
		manager: EntityManager,
		sandbox: Sandbox,
		service: SystemExposureService
	): Promise<string | null> {
		if (service !== SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS) return null;
		const sandboxWithBuildInfo = await manager.findOne(
			Sandbox,
			{ id: sandbox.id, organizationId: sandbox.organizationId },
			{ populate: ['buildInfo'] }
		);
		const targetReference =
			sandboxWithBuildInfo?.buildInfo?.snapshotRef ?? null;
		if (!targetReference) {
			throw new NotFoundException('Sandbox build logs are not available');
		}
		return targetReference;
	}

	private async assertSshCapable(
		manager: EntityManager,
		sandbox: Sandbox
	): Promise<void> {
		const placement = await manager.findOne(SandboxPlacement, {
			sandboxId: sandbox.id,
			releasedAt: null,
		});
		const machine = placement
			? await manager.findOne(Machine, { id: placement.machineId })
			: null;
		if (!machine?.sshHostPublicKey) {
			throw new ConflictException(
				'Sandbox machine has no private SSH relay capability'
			);
		}
	}

	private async refreshMaterialization(
		manager: EntityManager,
		exposure: Exposure,
		observedAt: Date
	): Promise<void> {
		const liveMaterialization = await manager.findOne(
			ExposureBackend,
			{
				exposureId: exposure.id,
				exposureGeneration: exposure.generation,
				state: {
					$in: [EXPOSURE_BACKEND_STATE.PENDING, EXPOSURE_BACKEND_STATE.ACTIVE],
				},
				leaseExpiresAt: { $gt: observedAt },
			},
			{ fields: ['id'], disableIdentityMap: true }
		);
		if (!liveMaterialization) {
			await this.exposureQueue.wake(manager, exposure.id, exposure.generation);
		}
	}

	async coverSession(
		exposureId: string,
		generation: number,
		until: Date
	): Promise<boolean> {
		return this.entityManager.transactional(
			async (manager) => {
				const [exposure] = await lockExposures(manager, [exposureId]);
				if (
					exposure?.kind !== EXPOSURE_KIND.SYSTEM ||
					exposure.generation !== generation ||
					exposure.desiredState !== EXPOSURE_DESIRED_STATE.ACTIVE ||
					!exposure.systemRequestedUntil
				) {
					return false;
				}
				if (exposure.systemRequestedUntil >= until) return true;
				if (systemExposureNeedsRuntime(exposure.systemService)) {
					const sandbox = await manager.findOne(Sandbox, {
						id: exposure.sandboxId,
						organizationId: exposure.organizationId,
					});
					if (!sandbox) return false;
					await this.billingAuthorizations.renewForSandbox(manager, sandbox);
				}
				exposure.systemRequestedUntil = until;
				return true;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async expireDue(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const due = await this.entityManager.find(
				Exposure,
				{
					kind: EXPOSURE_KIND.SYSTEM,
					desiredState: EXPOSURE_DESIRED_STATE.ACTIVE,
					systemRequestedUntil: { $lte: await databaseNow(this.entityManager) },
				},
				{
					orderBy: { systemRequestedUntil: 'ASC' },
					limit: SYSTEM_EXPOSURE_LEASE.expirationBatchSize,
				}
			);
			for (const exposure of due) {
				try {
					await this.expire(exposure.id, exposure.generation);
				} catch (error) {
					this.logger.warn(
						`System exposure ${exposure.id} expiry failed: ${errorMessage(error)}`
					);
				}
			}
		});
	}

	private async expire(exposureId: string, generation: number): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const [exposure] = await lockExposures(manager, [exposureId]);
				const observedAt = await databaseNow(manager);
				if (
					!exposure ||
					exposure.generation !== generation ||
					exposure.desiredState !== EXPOSURE_DESIRED_STATE.ACTIVE ||
					!exposure.systemRequestedUntil ||
					exposure.systemRequestedUntil > observedAt
				)
					return;
				exposure.desiredState = EXPOSURE_DESIRED_STATE.DISABLED;
				exposure.observedState = EXPOSURE_OBSERVED_STATE.PENDING;
				exposure.systemRequestedUntil = null;
				exposure.targetReference = null;
				exposure.generation += 1;
				await this.exposureQueue.enqueue(
					manager,
					exposure.id,
					exposure.generation
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}
