/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { raw, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PlacementBillingAuthorizationService } from '../../../billing/services/placement/placement-billing-authorization.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SandboxService } from '../../../sandbox/services/sandbox/sandbox.service';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	CUSTOM_DOMAIN_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	EXPOSURE_OBSERVED_STATE,
} from '../../constants/exposure.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type { ExposureDto, UpdateExposureDto } from '../../dto/exposure.dto';
import { CustomDomain } from '../../entities/custom-domain.entity';
import { Exposure } from '../../entities/exposure.entity';
import { toExposureDto } from '../../utils/exposure/exposure-dto.util';
import {
	assertPublicIngressAllowed,
	normalizeExposurePolicy,
} from '../../utils/exposure/exposure-policy.util';
import { assertUserExposureTargetPort } from '../../utils/exposure/user-exposure-target-port.util';
import { lockExposures } from '../../utils/network-lock.util';
import { ExposureReconciliationQueueService } from './exposure-reconciliation-queue.service';

@Injectable()
export class ExposureService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxService: SandboxService,
		private readonly billingAuthorizations: PlacementBillingAuthorizationService,
		private readonly settings: SettingsService,
		private readonly reconciliationQueue: ExposureReconciliationQueueService
	) {}

	async findAll(
		organizationId: string,
		sandboxId: string
	): Promise<ExposureDto[]> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxId,
			organizationId
		);
		const exposures = await this.entityManager.find(
			Exposure,
			{
				organizationId,
				sandboxId: sandbox.id,
				desiredState: { $ne: EXPOSURE_DESIRED_STATE.DELETED },
			},
			{ orderBy: { createdAt: 'ASC' } }
		);
		return exposures.map(toExposureDto);
	}

	async findOne(
		organizationId: string,
		sandboxId: string,
		exposureId: string
	): Promise<ExposureDto> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxId,
			organizationId
		);
		const exposure = await this.entityManager.findOne(Exposure, {
			id: exposureId,
			organizationId,
			sandboxId: sandbox.id,
			desiredState: { $ne: EXPOSURE_DESIRED_STATE.DELETED },
		});
		if (!exposure) throw new NotFoundException('Exposure not found');
		return toExposureDto(exposure);
	}

	async update(
		organizationId: string,
		sandboxId: string,
		exposureId: string,
		input: UpdateExposureDto
	): Promise<ExposureDto> {
		assertUserExposureTargetPort(input.targetPort);
		assertPublicIngressAllowed(
			input.policy,
			(await this.settings.get()).publicIngressEnabled
		);
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxId,
			organizationId
		);
		return this.entityManager.transactional(
			async (manager) => {
				const [exposure] = await lockExposures(manager, [exposureId], {
					organizationId,
					sandboxId: sandbox.id,
				});
				if (!exposure) throw new NotFoundException('Exposure not found');
				await this.billingAuthorizations.renewForSandbox(manager, sandbox);
				if (exposure.desiredState === EXPOSURE_DESIRED_STATE.DELETING) {
					throw new ConflictException('Deleting exposure cannot be updated');
				}
				if (exposure.kind === EXPOSURE_KIND.SYSTEM) {
					throw new ConflictException('System exposures cannot be edited');
				}
				if (input.policy.protocol !== exposure.protocol) {
					throw new ConflictException('Exposure protocol cannot be changed');
				}
				exposure.targetPort = input.targetPort;
				exposure.policy = normalizeExposurePolicy(input.policy);
				exposure.visibility =
					input.policy.protocol === NETWORK_PROTOCOL.HTTP
						? input.policy.visibility
						: null;
				exposure.managedDnsDeletedAt = null;
				exposure.generation += 1;
				exposure.observedState = EXPOSURE_OBSERVED_STATE.PENDING;
				exposure.lastError = null;
				await this.reconciliationQueue.enqueue(
					manager,
					exposure.id,
					exposure.generation
				);
				return toExposureDto(exposure);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async remove(
		organizationId: string,
		sandboxId: string,
		exposureId: string
	): Promise<void> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxId,
			organizationId
		);
		await this.entityManager.transactional(
			async (manager) => {
				const [exposure] = await lockExposures(manager, [exposureId], {
					organizationId,
					sandboxId: sandbox.id,
				});
				if (!exposure) throw new NotFoundException('Exposure not found');
				if (exposure.kind === EXPOSURE_KIND.SYSTEM) {
					throw new ConflictException('System exposures cannot be deleted');
				}
				if (exposure.desiredState === EXPOSURE_DESIRED_STATE.DELETING) return;
				const now = await databaseNow(manager);
				exposure.desiredState = EXPOSURE_DESIRED_STATE.DELETING;
				exposure.observedState = EXPOSURE_OBSERVED_STATE.DELETING;
				exposure.deletionRequestedAt = now;
				exposure.generation += 1;
				await manager.nativeUpdate(
					CustomDomain,
					{
						exposureId: exposure.id,
						state: { $ne: CUSTOM_DOMAIN_STATE.DELETING },
					},
					{
						state: CUSTOM_DOMAIN_STATE.DELETING,
						desiredGeneration: raw('"desiredGeneration" + 1'),
						deletionRequestedAt: now,
						lastError: null,
						updatedAt: now,
					}
				);
				await this.reconciliationQueue.enqueue(
					manager,
					exposure.id,
					exposure.generation
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}
