/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { RequestContext, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { SandboxPersistenceEvents } from '../../../../sandbox/instance/constants/sandbox-persistence-events.constants';
import { Sandbox } from '../../../../sandbox/instance/entities/sandbox.entity';
import { SandboxDesiredState } from '../../../../sandbox/instance/enums/sandbox-desired-state.enum';
import { SandboxPersistedEvent } from '../../../../sandbox/instance/events/sandbox-persisted.event';
import {
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	EXPOSURE_OBSERVED_STATE,
	EXPOSURE_TARGET_HOST,
	EXPOSURE_VISIBILITY,
	type ExposureTargetHost,
	SYSTEM_EXPOSURE_SERVICE,
	SYSTEM_EXPOSURE_TARGET_PORT,
	type SystemExposureService,
} from '../../constants/exposure.constants';
import {
	HTTP_UPSTREAM_PROTOCOL,
	NETWORK_PROTOCOL,
	NETWORKING_LIMITS,
	ORIGIN_HOSTNAME_PREFIX,
	PROXY_PROTOCOL,
} from '../../constants/networking.constants';
import { Exposure } from '../../entities/exposure.entity';
import type { ExposurePolicy } from '../../types/networking.types';
import { isSecurePublicOrigin } from '../../utils/exposure/platform-exposure-url.util';
import { ExposureReconciliationQueueService } from './exposure-reconciliation-queue.service';

const SYSTEM_EXPOSURE_RECONCILIATION_BATCH_SIZE = 100;
interface SystemExposureDefinition {
	service: SystemExposureService;
	protocol: typeof NETWORK_PROTOCOL.HTTP | typeof NETWORK_PROTOCOL.TCP;
	targetHost: ExposureTargetHost;
	policy: ExposurePolicy;
}

const SYSTEM_EXPOSURE_DEFINITIONS: readonly SystemExposureDefinition[] = [
	SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
	SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS,
	SYSTEM_EXPOSURE_SERVICE.TERMINAL,
	SYSTEM_EXPOSURE_SERVICE.DESKTOP,
].map((service) => ({
	service,
	protocol: NETWORK_PROTOCOL.HTTP,
	targetHost:
		service === SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS
			? EXPOSURE_TARGET_HOST.MACHINE_BUILD_LOGS
			: EXPOSURE_TARGET_HOST.RUNTIME,
	policy: {
		protocol: NETWORK_PROTOCOL.HTTP,
		visibility: EXPOSURE_VISIBILITY.PROTECTED,
		path: '/',
		stripPath: false,
		forceHttps: true,
		maxBodyBytes: NETWORKING_LIMITS.maximumHttpBodyBytes,
		readTimeoutSeconds: NETWORKING_LIMITS.maximumTimeoutSeconds,
		sendTimeoutSeconds: NETWORKING_LIMITS.maximumTimeoutSeconds,
		retries: 0,
		streaming: true,
		upstreamProtocol: HTTP_UPSTREAM_PROTOCOL.HTTP,
		allowedOrigins: [],
		allowCredentials: false,
		showBrowserWarning: false,
	},
}));

const SYSTEM_EXPOSURES: readonly SystemExposureDefinition[] = [
	...SYSTEM_EXPOSURE_DEFINITIONS,
	{
		service: SYSTEM_EXPOSURE_SERVICE.SSH,
		protocol: NETWORK_PROTOCOL.TCP,
		targetHost: EXPOSURE_TARGET_HOST.MACHINE_SSH_GATEWAY,
		policy: {
			protocol: NETWORK_PROTOCOL.TCP,
			proxyProtocol: PROXY_PROTOCOL.DISABLED,
			idleTimeoutSeconds: NETWORKING_LIMITS.maximumTimeoutSeconds,
			connectionLimit: 32,
		},
	},
];

@Injectable()
export class SystemExposureProvisionerService {
	private readonly logger = new Logger(SystemExposureProvisionerService.name);
	private readonly platformDomain: string;
	private readonly dashboardOrigin: string;
	private readonly forceHttps: boolean;

	constructor(
		private readonly entityManager: EntityManager,
		config: TypedConfigService,
		private readonly exposureQueue: ExposureReconciliationQueueService
	) {
		this.platformDomain = config
			.getOrThrow('networking.platformDomain')
			.toLowerCase();
		this.dashboardOrigin = new URL(config.getOrThrow('dashboardUrl')).origin;
		this.forceHttps = isSecurePublicOrigin(
			config.getOrThrow('networking.edgePublicOrigin')
		);
	}

	@OnEvent(SandboxPersistenceEvents.CREATED)
	handleSandboxPersisted(event: SandboxPersistedEvent): Promise<void> {
		return this.ensure(event.manager, event.sandbox.id);
	}

	async reconcileMissing(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const rows = await this.entityManager.execute<{ id: string }[]>(
				`SELECT sandbox.id
				 FROM "sandbox" sandbox
				 WHERE sandbox."desiredState" <> ?
				   AND ((
					SELECT COUNT(DISTINCT exposure."systemService")
					FROM "sandbox_exposure" exposure
					WHERE exposure."sandboxId" = sandbox.id
					  AND exposure.kind = ?
				   ) < ? OR EXISTS (
					SELECT 1
					FROM "sandbox_exposure" exposure
					WHERE exposure."sandboxId" = sandbox.id
					  AND exposure.kind = ?
					  AND exposure.protocol = ?
					  AND (
						exposure.policy -> 'allowedOrigins' <> CAST(? AS jsonb)
						OR exposure.policy ->> 'allowCredentials' <> 'true'
						OR exposure.policy ->> 'forceHttps' <> ?
					  )
				   ))
				 ORDER BY sandbox."createdAt" ASC
				 LIMIT ?`,
				[
					SandboxDesiredState.DESTROYED,
					EXPOSURE_KIND.SYSTEM,
					SYSTEM_EXPOSURES.length,
					EXPOSURE_KIND.SYSTEM,
					NETWORK_PROTOCOL.HTTP,
					JSON.stringify([this.dashboardOrigin]),
					String(this.forceHttps),
					SYSTEM_EXPOSURE_RECONCILIATION_BATCH_SIZE,
				]
			);
			for (const { id: sandboxId } of rows) {
				try {
					await this.entityManager.transactional(
						(manager) => this.ensure(manager, sandboxId),
						{ propagation: TransactionPropagation.REQUIRED }
					);
				} catch (error) {
					this.logger.warn(
						`System exposure provisioning failed for sandbox ${sandboxId}: ${errorMessage(error)}`
					);
				}
			}
		});
	}

	private async ensure(
		manager: EntityManager,
		sandboxId: string
	): Promise<void> {
		const sandboxWithBuildInfo = await manager.findOne(
			Sandbox,
			{ id: sandboxId },
			{ populate: ['buildInfo'] }
		);
		if (
			!sandboxWithBuildInfo ||
			sandboxWithBuildInfo.desiredState === SandboxDesiredState.DESTROYED
		) {
			return;
		}
		const buildReference = sandboxWithBuildInfo?.buildInfo?.snapshotRef ?? null;
		const existing = await manager.find(Exposure, {
			sandboxId,
			kind: EXPOSURE_KIND.SYSTEM,
		});
		const existingServices = new Set(
			existing.map((exposure) => exposure.systemService)
		);
		for (const exposure of existing) {
			await this.reconcileExisting(manager, exposure, buildReference);
		}
		const missing = SYSTEM_EXPOSURES.filter(
			(definition) => !existingServices.has(definition.service)
		);
		if (missing.length === 0) return;

		await this.createMissing(manager, sandboxWithBuildInfo, missing);
	}

	private async reconcileExisting(
		manager: EntityManager,
		exposure: Exposure,
		buildReference: string | null
	): Promise<void> {
		if (exposure.desiredState === EXPOSURE_DESIRED_STATE.DELETED) return;
		const definition = SYSTEM_EXPOSURES.find(
			(candidate) => candidate.service === exposure.systemService
		);
		if (!definition) return;
		const wasActive = exposure.desiredState === EXPOSURE_DESIRED_STATE.ACTIVE;
		const policy = this.policyFor(definition);
		const targetPort = SYSTEM_EXPOSURE_TARGET_PORT[definition.service];
		const buildLogsActive =
			definition.service === SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS && wasActive;
		const targetReference = buildLogsActive ? buildReference : null;
		if (buildLogsActive && !targetReference) {
			exposure.desiredState = EXPOSURE_DESIRED_STATE.DISABLED;
			exposure.systemRequestedUntil = null;
		}
		if (
			exposure.targetPort === targetPort &&
			exposure.targetHost === definition.targetHost &&
			exposure.targetReference === targetReference &&
			isDeepStrictEqual(exposure.policy, policy)
		) {
			return;
		}
		exposure.targetPort = targetPort;
		exposure.targetHost = definition.targetHost;
		exposure.targetReference = targetReference;
		exposure.policy = policy;
		exposure.generation += 1;
		exposure.observedState = EXPOSURE_OBSERVED_STATE.PENDING;
		exposure.lastError = null;
		if (wasActive || exposure.desiredState === EXPOSURE_DESIRED_STATE.ACTIVE) {
			await this.exposureQueue.enqueue(
				manager,
				exposure.id,
				exposure.generation
			);
		}
	}

	private async createMissing(
		manager: EntityManager,
		sandbox: Sandbox,
		missing: readonly SystemExposureDefinition[]
	): Promise<void> {
		const sandboxId = sandbox.id;
		const createdAt = await databaseNow(manager);
		const exposures = missing.map((definition) => {
			const routingKey = randomBytes(
				NETWORKING_LIMITS.routingKeyBytes
			).toString('hex');
			const hostnames = this.hostnames(sandboxId, definition, routingKey);
			return {
				id: randomUUID(),
				organizationId: sandbox.organizationId,
				sandboxId,
				name: definition.service,
				kind: EXPOSURE_KIND.SYSTEM,
				protocol: definition.protocol,
				visibility: EXPOSURE_VISIBILITY.PROTECTED,
				systemService: definition.service,
				targetHost: definition.targetHost,
				targetReference: null,
				targetPort: SYSTEM_EXPOSURE_TARGET_PORT[definition.service],
				policy: this.policyFor(definition),
				desiredState: EXPOSURE_DESIRED_STATE.DISABLED,
				observedState: EXPOSURE_OBSERVED_STATE.PENDING,
				generation: 1,
				routingKey,
				platformHostname: hostnames.platform,
				originHostname: hostnames.origin,
				lastError: null,
				deletionRequestedAt: null,
				managedDnsDeletedAt: null,
				systemRequestedUntil: null,
				createdAt,
				updatedAt: createdAt,
			};
		});
		await manager
			.createQueryBuilder(Exposure)
			.insert(exposures)
			.onConflict()
			.ignore()
			.execute();
	}

	private policyFor(definition: SystemExposureDefinition): ExposurePolicy {
		if (definition.policy.protocol !== NETWORK_PROTOCOL.HTTP) {
			return { ...definition.policy };
		}
		return {
			...definition.policy,
			allowedOrigins: [this.dashboardOrigin],
			allowCredentials: true,
			forceHttps: this.forceHttps,
		};
	}

	private hostnames(
		sandboxId: string,
		definition: SystemExposureDefinition,
		routingKey: string
	): { platform: string | null; origin: string | null } {
		if (definition.protocol !== NETWORK_PROTOCOL.HTTP) {
			return { platform: null, origin: null };
		}
		const platform = `${definition.service}-${sandboxId}.${this.platformDomain}`;
		const origin = `${ORIGIN_HOSTNAME_PREFIX}${routingKey}.${this.platformDomain}`;
		if (
			platform.length > NETWORKING_LIMITS.maximumHostnameLength ||
			origin.length > NETWORKING_LIMITS.maximumHostnameLength
		) {
			throw new Error('System exposure hostname exceeds the DNS limit');
		}
		return { platform, origin };
	}
}
