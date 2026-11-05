/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { PlacementBillingAuthorizationService } from '../../../billing/services/placement/placement-billing-authorization.service';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SandboxService } from '../../../sandbox/services/sandbox/sandbox.service';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	EXPOSURE_OBSERVED_STATE,
	EXPOSURE_TARGET_HOST,
	EXPOSURE_VISIBILITY,
	type ExposureKind,
	PREVIEW_EXPOSURE,
} from '../../constants/exposure.constants';
import {
	HTTP_UPSTREAM_PROTOCOL,
	NETWORK_PROTOCOL,
	NETWORKING_LIMITS,
	type NetworkProtocol,
	ORIGIN_HOSTNAME_PREFIX,
} from '../../constants/networking.constants';
import type { CreateExposureDto, ExposureDto } from '../../dto/exposure.dto';
import { Exposure } from '../../entities/exposure.entity';
import { toExposureDto } from '../../utils/exposure/exposure-dto.util';
import {
	assertPublicIngressAllowed,
	normalizeExposurePolicy,
} from '../../utils/exposure/exposure-policy.util';
import { isSecurePublicOrigin } from '../../utils/exposure/platform-exposure-url.util';
import { assertUserExposureTargetPort } from '../../utils/exposure/user-exposure-target-port.util';
import { lockExposuresWhere } from '../../utils/network-lock.util';
import { ExposureReconciliationQueueService } from './exposure-reconciliation-queue.service';

const EXPOSURE_CREATION_LOCK_PREFIX = 'snapflow-exposure-create';

type NewUserExposure = Pick<
	Exposure,
	| 'organizationId'
	| 'name'
	| 'protocol'
	| 'visibility'
	| 'targetPort'
	| 'policy'
>;

@Injectable()
export class ExposureProvisioningService {
	private readonly forceHttps: boolean;

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxService: SandboxService,
		private readonly billingAuthorizations: PlacementBillingAuthorizationService,
		private readonly configService: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly reconciliationQueue: ExposureReconciliationQueueService
	) {
		this.forceHttps = isSecurePublicOrigin(
			configService.getOrThrow('networking.edgePublicOrigin')
		);
	}

	async create(
		organizationId: string,
		sandboxId: string,
		input: CreateExposureDto,
		manager?: EntityManager
	): Promise<ExposureDto> {
		assertUserExposureTargetPort(input.targetPort);
		assertPublicIngressAllowed(
			input.policy,
			(await this.settings.get()).publicIngressEnabled
		);
		try {
			const persist = async (entityManager: EntityManager) => {
				const sandbox = await this.sandboxService.findOneByIdOrName(
					sandboxId,
					organizationId,
					false,
					entityManager
				);
				await this.lockCreation(entityManager, sandbox.id);
				await this.billingAuthorizations.renewForSandbox(
					entityManager,
					sandbox
				);
				const protocol = input.policy.protocol;
				const exposure = await this.insert(entityManager, sandbox.id, {
					organizationId,
					name: input.name.trim().toLowerCase(),
					protocol,
					visibility:
						protocol === NETWORK_PROTOCOL.HTTP ? input.policy.visibility : null,
					targetPort: input.targetPort,
					policy: normalizeExposurePolicy(input.policy),
				});
				return toExposureDto(exposure);
			};
			return await (manager
				? persist(manager)
				: this.entityManager.transactional(persist, {
						propagation: TransactionPropagation.REQUIRED,
					}));
		} catch (error: unknown) {
			if (isUniqueViolation(error)) {
				throw new ConflictException(
					'Exposure name or hostname is already in use'
				);
			}
			throw error;
		}
	}

	async ensurePreview(
		organizationId: string,
		sandboxId: string,
		targetPort: number
	): Promise<ExposureDto> {
		assertUserExposureTargetPort(targetPort);
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxId,
			organizationId
		);
		return this.entityManager.transactional(
			async (manager) => {
				await this.lockCreation(manager, sandbox.id);
				const [existing] = await lockExposuresWhere(manager, {
					organizationId,
					sandboxId: sandbox.id,
					protocol: NETWORK_PROTOCOL.HTTP,
					targetPort,
					systemService: null,
					desiredState: { $ne: EXPOSURE_DESIRED_STATE.DELETED },
				});
				await this.billingAuthorizations.renewForSandbox(manager, sandbox);
				if (existing) {
					if (existing.desiredState === EXPOSURE_DESIRED_STATE.DELETING) {
						throw new ConflictException(
							'The canonical preview exposure is being deleted'
						);
					}
					if (existing.desiredState !== EXPOSURE_DESIRED_STATE.ACTIVE) {
						existing.desiredState = EXPOSURE_DESIRED_STATE.ACTIVE;
						existing.observedState = EXPOSURE_OBSERVED_STATE.PENDING;
						existing.generation += 1;
						existing.lastError = null;
						await this.reconciliationQueue.enqueue(
							manager,
							existing.id,
							existing.generation
						);
					}
					return toExposureDto(existing);
				}

				const visibility = EXPOSURE_VISIBILITY.PROTECTED;
				const exposure = await this.insert(manager, sandbox.id, {
					organizationId,
					name: `${PREVIEW_EXPOSURE.namePrefix}-${targetPort}`,
					protocol: NETWORK_PROTOCOL.HTTP,
					visibility,
					targetPort,
					policy: {
						protocol: NETWORK_PROTOCOL.HTTP,
						visibility,
						path: PREVIEW_EXPOSURE.path,
						stripPath: false,
						forceHttps: this.forceHttps,
						maxBodyBytes: NETWORKING_LIMITS.maximumHttpBodyBytes,
						readTimeoutSeconds: NETWORKING_LIMITS.maximumTimeoutSeconds,
						sendTimeoutSeconds: NETWORKING_LIMITS.maximumTimeoutSeconds,
						retries: 0,
						streaming: true,
						upstreamProtocol: HTTP_UPSTREAM_PROTOCOL.HTTP,
						allowedOrigins: [],
						allowCredentials: false,
						showBrowserWarning: true,
					},
				});
				return toExposureDto(exposure);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async lockCreation(
		manager: EntityManager,
		sandboxId: string
	): Promise<void> {
		await manager.execute('SELECT pg_advisory_xact_lock(hashtext(?))', [
			`${EXPOSURE_CREATION_LOCK_PREFIX}:${sandboxId}`,
		]);
	}

	private async insert(
		manager: EntityManager,
		sandboxId: string,
		fields: NewUserExposure
	): Promise<Exposure> {
		const count = await manager.count(Exposure, {
			sandboxId,
			systemService: null,
			desiredState: { $ne: EXPOSURE_DESIRED_STATE.DELETED },
		});
		if (count >= NETWORKING_LIMITS.maximumExposuresPerSandbox) {
			throw new ConflictException('Sandbox has reached its exposure limit');
		}
		const routingKey = randomBytes(NETWORKING_LIMITS.routingKeyBytes).toString(
			'hex'
		);
		const hostnames = this.platformHostnames(
			fields.protocol,
			sandboxId,
			fields.targetPort,
			routingKey
		);
		const now = await databaseNow(manager);
		const exposure = manager.create(Exposure, {
			...fields,
			id: randomUUID(),
			sandboxId,
			kind: this.kindFor(fields.protocol),
			systemService: null,
			targetHost: EXPOSURE_TARGET_HOST.RUNTIME,
			targetReference: null,
			desiredState: EXPOSURE_DESIRED_STATE.ACTIVE,
			observedState: EXPOSURE_OBSERVED_STATE.PENDING,
			generation: 1,
			routingKey,
			platformHostname: hostnames.platform,
			originHostname: hostnames.origin,
			lastError: null,
			deletionRequestedAt: null,
			managedDnsDeletedAt: null,
			systemRequestedUntil: null,
			createdAt: now,
			updatedAt: now,
		});
		manager.persist(exposure);
		await manager.flush();
		await this.reconciliationQueue.enqueue(
			manager,
			exposure.id,
			exposure.generation
		);
		return exposure;
	}

	private kindFor(protocol: NetworkProtocol): ExposureKind {
		switch (protocol) {
			case NETWORK_PROTOCOL.HTTP:
				return EXPOSURE_KIND.HTTP;
			case NETWORK_PROTOCOL.TCP:
				return EXPOSURE_KIND.TCP;
			case NETWORK_PROTOCOL.UDP:
				return EXPOSURE_KIND.UDP;
		}
	}

	private platformHostnames(
		protocol: NetworkProtocol,
		sandboxId: string,
		targetPort: number,
		routingKey: string
	): { platform: string | null; origin: string | null } {
		if (protocol !== NETWORK_PROTOCOL.HTTP) {
			return { platform: null, origin: null };
		}
		const domain = this.configService
			.getOrThrow('networking.platformDomain')
			.toLowerCase();
		const platform = `${targetPort}-${sandboxId}.${domain}`;
		const origin = `${ORIGIN_HOSTNAME_PREFIX}${routingKey}.${domain}`;
		if (
			platform.length > NETWORKING_LIMITS.maximumHostnameLength ||
			origin.length > NETWORKING_LIMITS.maximumHostnameLength
		) {
			throw new ConflictException('Exposure hostname exceeds the DNS limit');
		}
		return { platform, origin };
	}
}
