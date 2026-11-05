/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Redis } from 'ioredis';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { AUTH_CREDENTIAL_TYPES } from '../../../common/types/organization-auth-context.types';
import { SYSTEM_EXPOSURE_SERVICE } from '../../constants/exposure.constants';
import { PROTECTED_ACCESS } from '../../constants/protected-access.constants';
import {
	accessSessionRedisKey,
	STORED_ACCESS_RECORD,
	type StoredAccessSession,
	storedAccessSessionSchema,
} from '../../utils/protected-access-session.util';
import { SystemExposureLeaseService } from '../exposure/system-exposure-lease.service';
import { ProtectedAccessSessionService } from './protected-access-session.service';
import { ProtectedAccessSessionStandingService } from './protected-access-session-standing.service';

const EDGE_ID = '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e7f';
const OTHER_EDGE_ID = '6071a2b3-c4d5-4e6f-8a9b-0c1d2e3f4a5b';
const IDLE_LIFETIME_SECONDS = 300;
const IDLE_MILLISECONDS = IDLE_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND;
const REMAINING = { due: IDLE_MILLISECONDS / 4, fresh: IDLE_MILLISECONDS };
const EVAL_KEYS_OFFSET = 2;
const NOW = new Date('2026-10-04T12:00:00.000Z');
const SESSION_IDS = {
	renewable: '5f607182-93a4-4b5c-8d6e-7f8091a2b3c4',
	fresh: '60718293-a4b5-4c6d-9e7f-8091a2b3c4d5',
	unauthorized: '718293a4-b5c6-4d7e-8f80-91a2b3c4d5e6',
	foreignEdge: '8293a4b5-c6d7-4e8f-9091-a2b3c4d5e6f7',
	missing: '93a4b5c6-d7e8-4f90-81a2-b3c4d5e6f708',
} as const;

function storedSession(
	sessionId: string,
	remainingMilliseconds: number,
	edgeId = EDGE_ID
): StoredAccessSession {
	return {
		version: STORED_ACCESS_RECORD.version,
		credential: {
			type: AUTH_CREDENTIAL_TYPES.API_KEY,
			id: 'a4b5c6d7-e8f9-4a01-92b3-c4d5e6f70819',
		},
		sessionId,
		edgeId,
		backendId: '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e',
		sandboxId: 'sandbox-1',
		exposureId: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
		exposureGeneration: 1,
		systemService: SYSTEM_EXPOSURE_SERVICE.DESKTOP,
		interactive: true,
		organizationId: '8e0d3b5f-6c2e-4d4b-8f9a-2b3c4d5e6f70',
		userId: '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f',
		idleLifetimeSeconds: IDLE_LIFETIME_SECONDS,
		absoluteExpiresAt: new Date(
			NOW.getTime() +
				PROTECTED_ACCESS.absoluteSessionLifetimeSeconds *
					MILLISECONDS_PER_SECOND
		).toISOString(),
		expiresAt: new Date(NOW.getTime() + remainingMilliseconds).toISOString(),
	};
}

class SessionRedis {
	readonly values = new Map<string, string>();

	async mget(...keys: string[]): Promise<(string | null)[]> {
		return keys.map((key) => this.values.get(key) ?? null);
	}

	async del(...keys: string[]): Promise<number> {
		return keys.filter((key) => this.values.delete(key)).length;
	}

	async eval(...args: string[]): Promise<number> {
		const [key, expected, replacement] = args.slice(EVAL_KEYS_OFFSET);
		if (this.values.get(key) !== expected) return 0;
		this.values.set(key, replacement);
		return 1;
	}
}

interface LeaseCoverage {
	exposureId: string;
	generation: number;
	until: Date;
}

function fixture(
	revokedIds: readonly string[],
	leaseCovers: boolean
): {
	service: ProtectedAccessSessionService;
	redis: SessionRedis;
	coverage: LeaseCoverage[];
} {
	const redis = new SessionRedis();
	for (const session of [
		storedSession(SESSION_IDS.renewable, REMAINING.due),
		storedSession(SESSION_IDS.fresh, REMAINING.fresh),
		storedSession(SESSION_IDS.unauthorized, REMAINING.fresh),
		storedSession(SESSION_IDS.foreignEdge, REMAINING.fresh, OTHER_EDGE_ID),
	]) {
		redis.values.set(
			accessSessionRedisKey(session.sessionId),
			JSON.stringify(session)
		);
	}
	const coverage: LeaseCoverage[] = [];
	const standing = fakeInstance(ProtectedAccessSessionStandingService, {
		findRevoked: async () => new Set<string>(revokedIds),
	});
	const leases = fakeInstance(SystemExposureLeaseService, {
		coverSession: async (
			exposureId: string,
			generation: number,
			until: Date
		) => {
			coverage.push({ exposureId, generation, until });
			return leaseCovers;
		},
	});
	return {
		service: new ProtectedAccessSessionService(
			fakeInstance(Redis, {
				mget: redis.mget.bind(redis),
				del: redis.del.bind(redis),
				eval: redis.eval.bind(redis),
			}),
			standing,
			leases
		),
		redis,
		coverage,
	};
}

describe('ProtectedAccessSessionService.observe', () => {
	it('renews due sessions with their lease and revokes ended or unauthorized ones', async () => {
		const { service, redis, coverage } = fixture(
			[SESSION_IDS.unauthorized],
			true
		);
		const observation = await service.observe(
			EDGE_ID,
			Object.values(SESSION_IDS),
			NOW
		);

		const renewedUntil = new Date(NOW.getTime() + IDLE_MILLISECONDS);
		const renewable = storedSession(SESSION_IDS.renewable, REMAINING.due);
		assert.deepEqual(
			coverage,
			[
				{
					exposureId: renewable.exposureId,
					generation: renewable.exposureGeneration,
					until: renewedUntil,
				},
			],
			'only the due session extends its system exposure lease'
		);
		assert.deepEqual(
			new Map(
				observation.sessions.map(({ sessionId, expiresAt }) => [
					sessionId,
					expiresAt,
				])
			),
			new Map([
				[SESSION_IDS.renewable, renewedUntil.toISOString()],
				[
					SESSION_IDS.fresh,
					new Date(NOW.getTime() + REMAINING.fresh).toISOString(),
				],
			])
		);
		assert.deepEqual(
			new Set(observation.revokedSessionIds),
			new Set([
				SESSION_IDS.unauthorized,
				SESSION_IDS.foreignEdge,
				SESSION_IDS.missing,
			])
		);
		assert.deepEqual(observation.activeSandboxIds, ['sandbox-1']);
		assert.equal(
			redis.values.has(accessSessionRedisKey(SESSION_IDS.unauthorized)),
			false,
			'an unauthorized session is deleted'
		);
		const stored = storedAccessSessionSchema.parse(
			JSON.parse(
				redis.values.get(accessSessionRedisKey(SESSION_IDS.renewable)) ?? ''
			)
		);
		assert.equal(stored.expiresAt, renewedUntil.toISOString());
	});

	it('keeps the confirmed expiry when the lease cannot be extended', async () => {
		const { service } = fixture([], false);
		const observation = await service.observe(
			EDGE_ID,
			[SESSION_IDS.renewable],
			NOW
		);
		assert.deepEqual(observation.sessions, [
			{
				sessionId: SESSION_IDS.renewable,
				expiresAt: new Date(NOW.getTime() + REMAINING.due).toISOString(),
			},
		]);
	});
});
