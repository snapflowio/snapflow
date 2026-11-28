/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	GatewayTimeoutException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { CommonErrorCode } from '../../../common/enums/common-error-code.enum';
import { apiError } from '../../../common/utils/error/api-error.util';
import { addSeconds } from '../../../common/utils/time.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_VISIBILITY,
	SYSTEM_EXPOSURE_SERVICE,
} from '../../constants/exposure.constants';
import { NETWORK_WAKE_TOPIC } from '../../constants/networking.constants';
import { PROTECTED_ACCESS } from '../../constants/protected-access.constants';
import {
	CreateProtectedAccessGrantDto,
	ProtectedAccessGrantDto,
	ProtectedAccessGrantRedemptionDto,
	RedeemProtectedAccessGrantDto,
} from '../../dto/protected-access.dto';
import { EdgeSession } from '../../entities/edge-session.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { NetworkingErrorCode } from '../../enums/networking-error-code.enum';
import { buildPlatformExposureUrl } from '../../utils/exposure/platform-exposure-url.util';
import { systemExposureRequiresSandboxWrite } from '../../utils/exposure/system-exposure-access-policy.util';
import {
	ACCESS_GRANT_INVALID,
	EXPOSURE_NOT_FOUND,
} from '../../utils/networking-error.util';
import {
	type AccessOwner,
	type AccessRequester,
	accessSessionRedisKey,
	grantRedisKey,
	isOwnedBy,
	millisecondsUntil,
	parseStoredRecord,
	redeemedGrantRedisKey,
	STORED_ACCESS_RECORD,
	type StoredGrant,
	storedAccessSessionSchema,
	storedGrantSchema,
} from '../../utils/protected-access-session.util';
import { SystemExposureLeaseService } from '../system-exposure/system-exposure-lease.service';
import { ProtectedAccessSessionService } from './protected-access-session.service';

const CONSUME_GRANT_KEY_COUNT = 3;
const consumeGrantScript = `
local current = redis.call('GET', KEYS[1])
if not current or current ~= ARGV[1] then
  return 0
end
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
redis.call('SET', KEYS[3], ARGV[4], 'PX', ARGV[5])
return 1
`;

const revokeGrantScript = `
local current = redis.call('GET', KEYS[1])
if not current or current ~= ARGV[1] then
  return 0
end
redis.call('DEL', KEYS[1])
return 1
`;
const SCRIPT_APPLIED = 1;

@Injectable()
export class ProtectedAccessGrantService {
	constructor(
		@InjectRedis() private readonly redis: Redis,
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly wakes: ControlWakeService,
		private readonly sessions: ProtectedAccessSessionService,
		private readonly leases: SystemExposureLeaseService
	) {}

	async issueWhenActive(
		requester: AccessRequester,
		sandboxId: string,
		exposureId: string,
		input: CreateProtectedAccessGrantDto,
		canWriteSandbox: boolean
	): Promise<ProtectedAccessGrantDto> {
		return this.issueWithActivationPolicy(
			requester,
			sandboxId,
			exposureId,
			input,
			true,
			canWriteSandbox
		);
	}

	private async issueWithActivationPolicy(
		{ organizationId, userId, credential }: AccessRequester,
		sandboxId: string,
		exposureId: string,
		input: CreateProtectedAccessGrantDto,
		waitForActivation: boolean,
		canWriteSandbox = false
	): Promise<ProtectedAccessGrantDto> {
		if (
			input.sessionLifetimeSeconds !== undefined &&
			(!Number.isInteger(input.sessionLifetimeSeconds) ||
				input.sessionLifetimeSeconds <
					PROTECTED_ACCESS.minimumSessionLifetimeSeconds ||
				input.sessionLifetimeSeconds >
					PROTECTED_ACCESS.maximumSessionLifetimeSeconds)
		) {
			throw new BadRequestException(
				apiError(
					NetworkingErrorCode.ACCESS_LIFETIME_INVALID,
					`The session lifetime must be a whole number of seconds from ${PROTECTED_ACCESS.minimumSessionLifetimeSeconds} to ${PROTECTED_ACCESS.maximumSessionLifetimeSeconds}. Choose a value in that range.`
				)
			);
		}
		const exposure = await this.entityManager.findOne(Exposure, {
			id: exposureId,
			organizationId,
			sandboxId,
		});
		if (!exposure) {
			throw new NotFoundException(EXPOSURE_NOT_FOUND);
		}
		if (
			systemExposureRequiresSandboxWrite(exposure.systemService) &&
			!canWriteSandbox
		) {
			throw new ForbiddenException(
				apiError(
					CommonErrorCode.ACCESS_DENIED,
					'Opening this system service needs write access to the sandbox. Ask an owner or admin of the organization for access.'
				)
			);
		}
		if (exposure.visibility !== EXPOSURE_VISIBILITY.PROTECTED) {
			throw new ConflictException(
				apiError(
					NetworkingErrorCode.EXPOSURE_NOT_PROTECTED,
					'This exposure is not protected, so it needs no access link. Open its URL directly.'
				)
			);
		}
		if (!exposure.platformHostname) {
			throw new ConflictException(
				apiError(
					NetworkingErrorCode.EXPOSURE_NOT_READY,
					'The exposure has no Snapflow hostname yet. Wait until it is active, then try again.'
				)
			);
		}
		const backend = waitForActivation
			? await this.waitForActiveBackend(exposure)
			: await this.findActiveBackend(exposure);
		if (!backend) {
			throw new ConflictException(
				apiError(
					NetworkingErrorCode.EXPOSURE_NOT_READY,
					'The exposure is not live yet. Wait until it is active, then try again.'
				)
			);
		}
		const now = new Date();
		const grantExpiresAt = addSeconds(
			now,
			PROTECTED_ACCESS.grantLifetimeSeconds
		);
		const sessionLifetimeSeconds =
			input.sessionLifetimeSeconds ??
			PROTECTED_ACCESS.defaultSessionLifetimeSeconds;
		const sessionExpiresAt = addSeconds(now, sessionLifetimeSeconds);
		const absoluteExpiresAt = addSeconds(
			now,
			PROTECTED_ACCESS.absoluteSessionLifetimeSeconds
		);
		const interactive =
			exposure.systemService === SYSTEM_EXPOSURE_SERVICE.TERMINAL ||
			exposure.systemService === SYSTEM_EXPOSURE_SERVICE.DESKTOP;
		const token = randomBytes(PROTECTED_ACCESS.grantTokenBytes).toString(
			'base64url'
		);
		const grant = storedGrantSchema.parse({
			version: STORED_ACCESS_RECORD.version,
			credential: { type: credential.type, id: credential.id },
			sessionId: randomUUID(),
			edgeId: backend.edgeId,
			backendId: backend.id,
			assignmentGeneration: backend.assignmentGeneration,
			sandboxId: exposure.sandboxId,
			exposureId: exposure.id,
			exposureGeneration: exposure.generation,
			exposureName: exposure.name,
			targetPort: exposure.targetPort,
			systemService: exposure.systemService ?? null,
			interactive,
			organizationId,
			userId,
			audience: STORED_ACCESS_RECORD.audience,
			idleLifetimeSeconds: sessionLifetimeSeconds,
			absoluteExpiresAt: absoluteExpiresAt.toISOString(),
			grantExpiresAt: grantExpiresAt.toISOString(),
			sessionExpiresAt: sessionExpiresAt.toISOString(),
		});
		await this.redis.setex(
			grantRedisKey(token),
			PROTECTED_ACCESS.grantLifetimeSeconds,
			JSON.stringify(grant)
		);
		const url = buildPlatformExposureUrl(
			this.config.getOrThrow('networking.edgePublicOrigin'),
			exposure.platformHostname
		);
		url.searchParams.set(PROTECTED_ACCESS.grantQueryParameter, token);
		url.searchParams.set(PROTECTED_ACCESS.backendQueryParameter, backend.id);
		return {
			token,
			backendId: backend.id,
			expiresAt: grantExpiresAt.toISOString(),
			sessionExpiresAt: sessionExpiresAt.toISOString(),
			url: url.toString(),
		};
	}

	private findActiveBackend(
		exposure: Exposure
	): Promise<ExposureBackend | null> {
		return this.entityManager.findOne(
			ExposureBackend,
			{
				exposureId: exposure.id,
				exposureGeneration: exposure.generation,
				state: EXPOSURE_BACKEND_STATE.ACTIVE,
			},
			{ orderBy: { activatedAt: 'DESC' } }
		);
	}

	private async waitForActiveBackend(
		exposure: Exposure
	): Promise<ExposureBackend> {
		const deadline =
			Date.now() + PROTECTED_ACCESS.backendActivationTimeoutMilliseconds;
		for (;;) {
			const wakeVersion = this.wakes.capture(
				NETWORK_WAKE_TOPIC.EXPOSURE_ACTIVATION,
				exposure.id
			);
			const backend = await this.findActiveBackend(exposure);
			if (backend) return backend;
			const remaining = deadline - Date.now();
			if (remaining <= 0 || this.wakes.isStopping()) {
				throw new GatewayTimeoutException(
					apiError(
						NetworkingErrorCode.EXPOSURE_NOT_READY,
						'The exposure did not become live in time. Try again in a few seconds.'
					)
				);
			}
			await this.wakes.waitForChange(
				NETWORK_WAKE_TOPIC.EXPOSURE_ACTIVATION,
				exposure.id,
				wakeVersion,
				Math.min(
					remaining,
					PROTECTED_ACCESS.backendActivationRecheckMilliseconds
				)
			);
		}
	}

	async revoke(
		organizationId: string,
		sandboxId: string,
		exposureId: string,
		token: string
	): Promise<void> {
		if (token.length > PROTECTED_ACCESS.maximumGrantLength) return;
		const owner: AccessOwner = {
			organizationId,
			sandboxId,
			exposureId,
		};
		const key = grantRedisKey(token);
		const serialized = await this.redis.get(key);
		if (!serialized) {
			await this.sessions.revokeRedeemed(token, owner);
			return;
		}
		const grant = parseStoredRecord(storedGrantSchema, serialized);
		if (!grant) {
			throw new ForbiddenException(ACCESS_GRANT_INVALID);
		}
		if (!isOwnedBy(grant, owner)) {
			throw new ForbiddenException(ACCESS_GRANT_INVALID);
		}
		await this.redis.eval(revokeGrantScript, 1, key, serialized);
	}

	async redeem(
		session: EdgeSession,
		input: RedeemProtectedAccessGrantDto
	): Promise<ProtectedAccessGrantRedemptionDto> {
		const grantKey = grantRedisKey(input.token);
		const serialized = await this.redis.get(grantKey);
		const grant = parseStoredRecord(storedGrantSchema, serialized);
		if (!serialized || !grant) {
			throw new ForbiddenException(ACCESS_GRANT_INVALID);
		}
		const now = new Date();
		if (
			grant.edgeId !== session.edgeId ||
			grant.backendId !== input.backendId ||
			new Date(grant.grantExpiresAt) <= now
		) {
			throw new ForbiddenException(ACCESS_GRANT_INVALID);
		}
		await this.assertRouteActive(grant);
		const accessSession = storedAccessSessionSchema.parse({
			version: grant.version,
			credential: grant.credential,
			sessionId: grant.sessionId,
			edgeId: grant.edgeId,
			backendId: grant.backendId,
			sandboxId: grant.sandboxId,
			exposureId: grant.exposureId,
			exposureGeneration: grant.exposureGeneration,
			systemService: grant.systemService,
			interactive: grant.interactive,
			organizationId: grant.organizationId,
			userId: grant.userId,
			idleLifetimeSeconds: grant.idleLifetimeSeconds,
			absoluteExpiresAt: grant.absoluteExpiresAt,
			expiresAt: grant.sessionExpiresAt,
		});
		const consumed = await this.redis.eval(
			consumeGrantScript,
			CONSUME_GRANT_KEY_COUNT,
			grantKey,
			accessSessionRedisKey(grant.sessionId),
			redeemedGrantRedisKey(input.token),
			serialized,
			JSON.stringify(accessSession),
			millisecondsUntil(grant.sessionExpiresAt, now).toString(),
			grant.sessionId,
			millisecondsUntil(grant.absoluteExpiresAt, now).toString()
		);
		if (consumed !== SCRIPT_APPLIED) {
			throw new ForbiddenException(ACCESS_GRANT_INVALID);
		}
		return {
			backendId: grant.backendId,
			sandboxId: grant.sandboxId,
			exposureId: grant.exposureId,
			exposureName: grant.exposureName,
			targetPort: grant.targetPort,
			interactive: grant.interactive,
			sessionId: grant.sessionId,
			expiresAt: grant.sessionExpiresAt,
			absoluteExpiresAt: grant.absoluteExpiresAt,
		};
	}

	private async assertRouteActive(grant: StoredGrant): Promise<void> {
		const observedAt = await databaseNow(this.entityManager);
		const backend = await this.entityManager.findOne(ExposureBackend, {
			id: grant.backendId,
			edgeId: grant.edgeId,
			exposureId: grant.exposureId,
			exposureGeneration: grant.exposureGeneration,
			assignmentGeneration: grant.assignmentGeneration,
			state: EXPOSURE_BACKEND_STATE.ACTIVE,
		});
		const routeActive =
			backend?.leaseExpiresAt !== undefined &&
			backend.leaseExpiresAt > observedAt &&
			(!grant.systemService ||
				(await this.leases.coverSession(
					grant.exposureId,
					grant.exposureGeneration,
					new Date(grant.sessionExpiresAt)
				)));
		if (!routeActive) {
			throw new ForbiddenException(ACCESS_GRANT_INVALID);
		}
	}
}
