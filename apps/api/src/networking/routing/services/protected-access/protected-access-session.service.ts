/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { errorMessage } from '../../../../common/utils/error/error.util';
import type { EdgeAccessSessionDto } from '../../dto/edge-heartbeat.dto';
import {
	type AccessOwner,
	accessSessionRedisKey,
	isOwnedBy,
	millisecondsUntil,
	parseStoredRecord,
	redeemedGrantRedisKey,
	renewedSessionExpiry,
	type StoredAccessSession,
	storedAccessSessionSchema,
} from '../../utils/protected-access-session.util';
import { SystemExposureLeaseService } from '../exposure/system-exposure-lease.service';
import { ProtectedAccessSessionStandingService } from './protected-access-session-standing.service';

const renewSessionScript = `
local current = redis.call('GET', KEYS[1])
if not current or current ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`;
const SCRIPT_APPLIED = 1;

export interface AccessSessionObservation {
	sessions: EdgeAccessSessionDto[];
	revokedSessionIds: string[];
	activeSandboxIds: string[];
}

interface LiveSession {
	session: StoredAccessSession;
	serialized: string;
}

@Injectable()
export class ProtectedAccessSessionService {
	private readonly logger = new Logger(ProtectedAccessSessionService.name);

	constructor(
		@InjectRedis() private readonly redis: Redis,
		private readonly standing: ProtectedAccessSessionStandingService,
		private readonly leases: SystemExposureLeaseService
	) {}

	async observe(
		edgeId: string,
		sessionIds: readonly string[],
		observedAt: Date
	): Promise<AccessSessionObservation> {
		const observation: AccessSessionObservation = {
			sessions: [],
			revokedSessionIds: [],
			activeSandboxIds: [],
		};
		if (sessionIds.length === 0) return observation;
		const values = await this.redis.mget(
			...sessionIds.map((sessionId) => accessSessionRedisKey(sessionId))
		);
		const live: LiveSession[] = [];
		for (const [index, serialized] of values.entries()) {
			const session = parseStoredRecord(storedAccessSessionSchema, serialized);
			if (
				!serialized ||
				session?.sessionId !== sessionIds[index] ||
				session.edgeId !== edgeId ||
				new Date(session.expiresAt) <= observedAt
			) {
				observation.revokedSessionIds.push(sessionIds[index]);
				continue;
			}
			live.push({ session, serialized });
		}
		const revoked = await this.standing.findRevoked(
			live.map(({ session }) => session),
			observedAt
		);
		if (revoked.size > 0) {
			await this.redis.del(
				...[...revoked].map((sessionId) => accessSessionRedisKey(sessionId))
			);
		}
		const activeSandboxIds = new Set<string>();
		for (const entry of live) {
			const { sessionId, interactive, sandboxId } = entry.session;
			if (revoked.has(sessionId)) {
				observation.revokedSessionIds.push(sessionId);
				continue;
			}
			observation.sessions.push({
				sessionId,
				expiresAt: await this.renew(entry, observedAt),
			});
			if (interactive) activeSandboxIds.add(sandboxId);
		}
		observation.activeSandboxIds = [...activeSandboxIds];
		return observation;
	}

	async revokeRedeemed(token: string, owner: AccessOwner): Promise<void> {
		const pointerKey = redeemedGrantRedisKey(token);
		const sessionId = await this.redis.get(pointerKey);
		if (!sessionId) return;
		const sessionKey = accessSessionRedisKey(sessionId);
		const session = parseStoredRecord(
			storedAccessSessionSchema,
			await this.redis.get(sessionKey)
		);
		if (session && !isOwnedBy(session, owner)) {
			throw new ForbiddenException(
				'Access grant does not belong to this organization'
			);
		}
		await this.redis.del(sessionKey, pointerKey);
	}

	private async renew(entry: LiveSession, now: Date): Promise<string> {
		const { session } = entry;
		const renewedAt = renewedSessionExpiry(session, now);
		if (!renewedAt || !(await this.coverLease(session, renewedAt))) {
			return session.expiresAt;
		}
		const renewed = storedAccessSessionSchema.parse({
			...session,
			expiresAt: renewedAt.toISOString(),
		});
		const applied = await this.redis.eval(
			renewSessionScript,
			1,
			accessSessionRedisKey(session.sessionId),
			entry.serialized,
			JSON.stringify(renewed),
			millisecondsUntil(renewed.expiresAt, now).toString()
		);
		return applied === SCRIPT_APPLIED ? renewed.expiresAt : session.expiresAt;
	}

	private async coverLease(
		session: StoredAccessSession,
		until: Date
	): Promise<boolean> {
		if (!session.systemService) return true;
		try {
			return await this.leases.coverSession(
				session.exposureId,
				session.exposureGeneration,
				until
			);
		} catch (error) {
			this.logger.warn(
				`Could not extend the ${session.systemService} lease for access session ${session.sessionId}: ${errorMessage(error)}`
			);
			return false;
		}
	}
}
