/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	LockMode,
	RequestContext,
	TransactionPropagation,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { CloudflareDomainProvider } from '../../cloudflare/services/cloudflare-domain-provider.service';
import {
	CUSTOM_DOMAIN_STATE,
	type CustomDomainState,
	EXPOSURE_BACKEND_STATE,
} from '../../constants/exposure.constants';
import { NETWORKING_LIMITS } from '../../constants/networking.constants';
import { CustomDomain } from '../../entities/custom-domain.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { ExposureReconciliationQueueService } from '../../services/exposure/exposure-reconciliation-queue.service';
import type { ManagedCustomHostname } from '../../types/networking.types';

const CUSTOM_DOMAIN_BATCH_SIZE = 50;
const ACTIVE_REFRESH_MINUTES = 5;
const ACTIVE_REFRESH_MILLISECONDS =
	ACTIVE_REFRESH_MINUTES * MILLISECONDS_PER_MINUTE;
const PROVIDER_ERROR_SEPARATOR = '; ';
const ACTIVE_PROVIDER_STATUS = 'active';
const TERMINAL_PROVIDER_STATUSES = new Set([
	'blocked',
	'deleted',
	'moved',
	'pending_blocked',
]);

function observedDomainState(
	managed: ManagedCustomHostname
): CustomDomainState {
	if (
		managed.hostnameStatus === ACTIVE_PROVIDER_STATUS &&
		managed.certificateStatus === ACTIVE_PROVIDER_STATUS
	) {
		return CUSTOM_DOMAIN_STATE.ACTIVE;
	}
	const terminal =
		managed.errors.length > 0 &&
		Boolean(
			managed.hostnameStatus &&
				TERMINAL_PROVIDER_STATUSES.has(managed.hostnameStatus)
		);
	return terminal ? CUSTOM_DOMAIN_STATE.FAILED : CUSTOM_DOMAIN_STATE.VALIDATING;
}

function applyObservation(
	domain: CustomDomain,
	managed: ManagedCustomHostname,
	originHostname: string,
	observedAt: Date
): void {
	const state = observedDomainState(managed);
	domain.providerId = managed.id;
	domain.providerHostnameStatus = managed.hostnameStatus;
	domain.certificateStatus = managed.certificateStatus;
	domain.originHostname = originHostname;
	domain.verificationRecords = managed.verificationRecords;
	domain.observedGeneration = domain.desiredGeneration;
	domain.lastSynchronizedAt = observedAt;
	domain.lastError =
		managed.errors
			.join(PROVIDER_ERROR_SEPARATOR)
			.slice(0, NETWORKING_LIMITS.maximumErrorLength) || null;
	domain.state = state;
	domain.activatedAt =
		state === CUSTOM_DOMAIN_STATE.ACTIVE
			? (domain.activatedAt ?? observedAt)
			: null;
}

@Injectable()
export class CustomDomainReconcilerService {
	private readonly logger = new Logger(CustomDomainReconcilerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly provider: CloudflareDomainProvider,
		private readonly exposureQueue: ExposureReconciliationQueueService
	) {}

	async reconcileDue(): Promise<void> {
		if (!this.provider.isConfigured()) return;
		await RequestContext.create(this.entityManager, async () => {
			const staleBefore = addMilliseconds(
				await databaseNow(this.entityManager),
				-ACTIVE_REFRESH_MILLISECONDS
			);
			const domains = await this.entityManager.find(
				CustomDomain,
				{
					$or: [
						{
							state: {
								$in: [
									CUSTOM_DOMAIN_STATE.PENDING,
									CUSTOM_DOMAIN_STATE.VALIDATING,
									CUSTOM_DOMAIN_STATE.FAILED,
									CUSTOM_DOMAIN_STATE.DELETING,
								],
							},
						},
						{ state: CUSTOM_DOMAIN_STATE.ACTIVE, lastSynchronizedAt: null },
						{
							state: CUSTOM_DOMAIN_STATE.ACTIVE,
							lastSynchronizedAt: { $lt: staleBefore },
						},
					],
				},
				{ orderBy: { updatedAt: 'ASC' }, limit: CUSTOM_DOMAIN_BATCH_SIZE }
			);
			for (const domain of domains) {
				try {
					await this.reconcile(domain.id);
				} catch (error) {
					await this.recordFailure(domain.id, domain.desiredGeneration, error);
				}
			}
		});
	}

	private async reconcile(domainId: string): Promise<void> {
		const domain = await this.entityManager.findOne(CustomDomain, {
			id: domainId,
		});
		if (!domain) return;
		const exposure = await this.entityManager.findOne(Exposure, {
			id: domain.exposureId,
		});
		if (!exposure) return;
		const generation = domain.desiredGeneration;
		if (domain.state === CUSTOM_DOMAIN_STATE.DELETING) {
			await this.provider.remove(
				domain.providerId,
				domain.hostname,
				domain.id,
				domain.exposureId
			);
			await this.completeDeletion(domain.id, generation, exposure);
			return;
		}
		const originHostname = exposure.originHostname;
		if (!originHostname) return;
		const now = await databaseNow(this.entityManager);
		const activeBackend = await this.entityManager.findOne(ExposureBackend, {
			exposureId: domain.exposureId,
			exposureGeneration: exposure.generation,
			state: EXPOSURE_BACKEND_STATE.ACTIVE,
			leaseExpiresAt: { $gt: now },
		});
		if (!activeBackend) return;
		const managed = await this.provider.ensure(
			domain.hostname,
			originHostname,
			domain.id,
			domain.exposureId
		);
		await this.entityManager.transactional(
			async (manager) => {
				const current = await manager.findOne(
					CustomDomain,
					{ id: domain.id },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!current || current.desiredGeneration !== generation) return;
				const wasActive = current.state === CUSTOM_DOMAIN_STATE.ACTIVE;
				applyObservation(
					current,
					managed,
					originHostname,
					await databaseNow(manager)
				);
				const active = current.state === CUSTOM_DOMAIN_STATE.ACTIVE;
				if (wasActive !== active) {
					await this.exposureQueue.enqueue(
						manager,
						exposure.id,
						exposure.generation
					);
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async completeDeletion(
		domainId: string,
		generation: number,
		exposure: Exposure
	): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const domain = await manager.findOne(
					CustomDomain,
					{ id: domainId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (
					!domain ||
					domain.desiredGeneration !== generation ||
					domain.state !== CUSTOM_DOMAIN_STATE.DELETING
				)
					return;
				manager.remove(domain);
				await this.exposureQueue.enqueue(
					manager,
					exposure.id,
					exposure.generation
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async recordFailure(
		domainId: string,
		generation: number,
		error: unknown
	): Promise<void> {
		const message = errorMessage(error).slice(
			0,
			NETWORKING_LIMITS.maximumErrorLength
		);
		this.logger.warn(
			`Custom domain ${domainId} reconciliation failed: ${message}`
		);
		const failedAt = await databaseNow(this.entityManager);
		await this.entityManager.nativeUpdate(
			CustomDomain,
			{ id: domainId, desiredGeneration: generation },
			{
				lastError: message,
				lastSynchronizedAt: failedAt,
				updatedAt: failedAt,
			}
		);
	}
}
