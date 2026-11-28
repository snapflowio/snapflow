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
import { apiError } from '../../../common/utils/error/api-error.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SandboxService } from '../../../sandbox/services/sandbox/sandbox.service';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	CUSTOM_DOMAIN_STATE,
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	EXPOSURE_OBSERVED_STATE,
} from '../../constants/exposure.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type {
	ExposureDto,
	ExposureEndpointDto,
	UpdateExposureDto,
} from '../../dto/exposure.dto';
import { CustomDomain } from '../../entities/custom-domain.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { NetworkingErrorCode } from '../../enums/networking-error-code.enum';
import { toExposureDto } from '../../utils/exposure/exposure-dto.util';
import {
	assertPublicIngressAllowed,
	normalizeExposurePolicy,
} from '../../utils/exposure/exposure-policy.util';
import { assertUserExposureTargetPort } from '../../utils/exposure/user-exposure-target-port.util';
import { lockExposures } from '../../utils/network-lock.util';
import { EXPOSURE_NOT_FOUND } from '../../utils/networking-error.util';
import { ExposureReconciliationQueueService } from './exposure-reconciliation-queue.service';

@Injectable()
export class ExposureService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxService: SandboxService,
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
		const endpoints = await this.servingEndpoints(exposures);
		return exposures.map((exposure) =>
			toExposureDto(exposure, endpoints.get(exposure.id))
		);
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
		if (!exposure) throw new NotFoundException(EXPOSURE_NOT_FOUND);
		const endpoints = await this.servingEndpoints([exposure]);
		return toExposureDto(exposure, endpoints.get(exposure.id));
	}

	private async servingEndpoints(
		exposures: Exposure[]
	): Promise<Map<string, ExposureEndpointDto>> {
		const portExposureIds = exposures
			.filter((exposure) => exposure.protocol !== NETWORK_PROTOCOL.HTTP)
			.map((exposure) => exposure.id);
		const endpoints = new Map<string, ExposureEndpointDto>();
		if (portExposureIds.length === 0) return endpoints;
		const backends = await this.entityManager.find(
			ExposureBackend,
			{
				exposureId: { $in: portExposureIds },
				state: EXPOSURE_BACKEND_STATE.ACTIVE,
				publicPort: { $ne: null },
			},
			{
				fields: ['exposureId', 'publicHost', 'publicPort'],
				orderBy: { activatedAt: 'DESC' },
			}
		);
		for (const backend of backends) {
			if (backend.publicPort === null || endpoints.has(backend.exposureId)) {
				continue;
			}
			endpoints.set(backend.exposureId, {
				host: backend.publicHost,
				port: backend.publicPort,
			});
		}
		return endpoints;
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
				if (!exposure) throw new NotFoundException(EXPOSURE_NOT_FOUND);
				if (exposure.desiredState === EXPOSURE_DESIRED_STATE.DELETING) {
					throw new ConflictException(
						apiError(
							NetworkingErrorCode.EXPOSURE_DELETING,
							'The exposure is being deleted and cannot be changed. Create a new exposure instead.'
						)
					);
				}
				if (exposure.kind === EXPOSURE_KIND.SYSTEM) {
					throw new ConflictException(
						apiError(
							NetworkingErrorCode.EXPOSURE_IMMUTABLE,
							'System exposures are managed by Snapflow and cannot be edited.'
						)
					);
				}
				if (input.policy.protocol !== exposure.protocol) {
					throw new ConflictException(
						apiError(
							NetworkingErrorCode.EXPOSURE_IMMUTABLE,
							'The protocol of an exposure cannot be changed. Delete the exposure and create a new one with the other protocol.'
						)
					);
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
				if (!exposure) throw new NotFoundException(EXPOSURE_NOT_FOUND);
				if (exposure.kind === EXPOSURE_KIND.SYSTEM) {
					throw new ConflictException(
						apiError(
							NetworkingErrorCode.EXPOSURE_IMMUTABLE,
							'System exposures are managed by Snapflow and cannot be deleted.'
						)
					);
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
