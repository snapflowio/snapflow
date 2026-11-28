/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { AUTH_CREDENTIAL_TYPES } from '../../common/types/organization-auth-context.types';
import { millisecondsBetween } from '../../common/utils/time.util';
import { SYSTEM_EXPOSURE_SERVICE } from '../constants/exposure.constants';
import { NETWORKING_LIMITS } from '../constants/networking.constants';
import { PROTECTED_ACCESS } from '../constants/protected-access.constants';

const STORED_RECORD_VERSION = 3;
const EDGE_AUDIENCE = 'snapflow-edge';

const accessCredentialSchema = z.object({
	type: z.enum([AUTH_CREDENTIAL_TYPES.SESSION, AUTH_CREDENTIAL_TYPES.API_KEY]),
	id: z.string().uuid(),
});
export type AccessCredential = z.infer<typeof accessCredentialSchema>;

const accessTargetShape = {
	version: z.literal(STORED_RECORD_VERSION),
	credential: accessCredentialSchema,
	sessionId: z.string().uuid(),
	edgeId: z.string().uuid(),
	backendId: z.string().uuid(),
	sandboxId: z.string().min(1),
	exposureId: z.string().uuid(),
	exposureGeneration: z.number().int().positive(),
	systemService: z.enum(SYSTEM_EXPOSURE_SERVICE).nullable(),
	interactive: z.boolean(),
	organizationId: z.string().uuid(),
	userId: z.string().uuid(),
	idleLifetimeSeconds: z
		.number()
		.int()
		.min(PROTECTED_ACCESS.minimumSessionLifetimeSeconds)
		.max(PROTECTED_ACCESS.maximumSessionLifetimeSeconds),
	absoluteExpiresAt: z.string().datetime(),
};

export const storedGrantSchema = z.object({
	...accessTargetShape,
	assignmentGeneration: z.number().int().positive(),
	exposureName: z.string().min(1),
	targetPort: z
		.number()
		.int()
		.min(NETWORKING_LIMITS.minimumPort)
		.max(NETWORKING_LIMITS.maximumPort),
	audience: z.literal(EDGE_AUDIENCE),
	grantExpiresAt: z.string().datetime(),
	sessionExpiresAt: z.string().datetime(),
});
export type StoredGrant = z.infer<typeof storedGrantSchema>;

export const storedAccessSessionSchema = z.object({
	...accessTargetShape,
	expiresAt: z.string().datetime(),
});
export type StoredAccessSession = z.infer<typeof storedAccessSessionSchema>;

export const STORED_ACCESS_RECORD = {
	version: STORED_RECORD_VERSION,
	audience: EDGE_AUDIENCE,
} as const;

export function grantRedisKey(token: string): string {
	return `${PROTECTED_ACCESS.redisKeyPrefix}${tokenDigest(token)}`;
}

export function redeemedGrantRedisKey(token: string): string {
	return `${PROTECTED_ACCESS.redeemedGrantRedisKeyPrefix}${tokenDigest(token)}`;
}

export function accessSessionRedisKey(sessionId: string): string {
	return `${PROTECTED_ACCESS.sessionRedisKeyPrefix}${sessionId}`;
}

export function parseStoredRecord<T>(
	schema: z.ZodType<T>,
	serialized: string | null
): T | null {
	if (!serialized) return null;
	let value: unknown;
	try {
		value = JSON.parse(serialized) as unknown;
	} catch {
		return null;
	}
	const parsed = schema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function millisecondsUntil(expiresAt: string, now: Date): number {
	return Math.max(1, millisecondsBetween(now, new Date(expiresAt)));
}

export function renewedSessionExpiry(
	session: StoredAccessSession,
	now: Date
): Date | null {
	const idleMilliseconds =
		session.idleLifetimeSeconds * MILLISECONDS_PER_SECOND;
	const expiresAt = new Date(session.expiresAt).getTime();
	if (
		expiresAt - now.getTime() >
		idleMilliseconds / PROTECTED_ACCESS.sessionRenewalDivisor
	) {
		return null;
	}
	const renewed = Math.min(
		now.getTime() + idleMilliseconds,
		new Date(session.absoluteExpiresAt).getTime()
	);
	return renewed > expiresAt ? new Date(renewed) : null;
}

function tokenDigest(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

export type AccessOwner = Pick<
	StoredAccessSession,
	'organizationId' | 'sandboxId' | 'exposureId'
>;

export type AccessRequester = Pick<
	StoredAccessSession,
	'organizationId' | 'userId' | 'credential'
>;

export function isOwnedBy(record: AccessOwner, owner: AccessOwner): boolean {
	return (
		record.organizationId === owner.organizationId &&
		record.sandboxId === owner.sandboxId &&
		record.exposureId === owner.exposureId
	);
}
