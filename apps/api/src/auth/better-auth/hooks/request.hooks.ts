/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BetterAuthOptions } from 'better-auth';
import {
	APIError,
	createAuthMiddleware,
	freshSessionMiddleware,
	getSessionFromCtx,
} from 'better-auth/api';
import {
	guardOrganizationRequest,
	handleOrganizationResponse,
	type OrganizationAuthHookDependencies,
} from '../../../organization/tenant/better-auth/organization-auth-hooks';
import {
	ADMIN_MFA_REQUIRED_CODE,
	ADMIN_MFA_REQUIRED_MESSAGE,
} from '../../../user/constants/admin-access.constants';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { AuthEvents } from '../../constants/auth-events.constants';
import {
	AUTH_PATH,
	FRESH_SESSION_AUTH_PATHS,
	SECOND_FACTOR_STEP_UP_PATHS,
} from '../../constants/auth-paths.constants';
import { ApiKeyRevokedEvent } from '../../events/api-key-revoked.event';
import { hasVerifiedSecondFactor } from '../../utils/second-factor.util';
import {
	type AccountOwnership,
	assertAccountDeletable,
} from '../account/account-deletion';
import { SECOND_FACTOR_VERIFIED_AT_FIELD } from '../schema/additional-fields';
import {
	type AuthMiddlewareContext,
	type AuthSession,
	resolveRequestSession,
} from './request-session';

const PASSKEY_MODEL = 'passkey';

export interface AuthHookDependencies extends OrganizationAuthHookDependencies {
	ownership: AccountOwnership;
}

export function createAuthHooks(
	dependencies: AuthHookDependencies
): NonNullable<BetterAuthOptions['hooks']> {
	return {
		before: createAuthMiddleware(async (context) => {
			if (!context.request) return;
			if (FRESH_SESSION_AUTH_PATHS.has(context.path)) {
				await resolveRequestSession(context);
				await freshSessionMiddleware(context);
			}
			if (context.path.startsWith(AUTH_PATH.ADMIN_PREFIX)) {
				await guardAdminRequest(context, dependencies.ownership);
			}
			if (context.path.startsWith(AUTH_PATH.ORGANIZATION_PREFIX)) {
				await guardOrganizationRequest(context, dependencies);
			}
		}),
		after: createAuthMiddleware(async (context) => {
			if (context.context.returned instanceof APIError) return;
			if (SECOND_FACTOR_STEP_UP_PATHS.has(context.path)) {
				await markSecondFactorVerified(context);
			}
			const apiKeyId = revokedApiKeyId(context);
			if (apiKeyId) {
				await dependencies.eventEmitter.emitAsync(
					AuthEvents.API_KEY_REVOKED,
					new ApiKeyRevokedEvent(apiKeyId)
				);
			}
			if (context.path.startsWith(AUTH_PATH.ORGANIZATION_PREFIX)) {
				await handleOrganizationResponse(context, dependencies);
			}
		}),
	};
}

async function guardAdminRequest(
	context: AuthMiddlewareContext,
	ownership: AccountOwnership
): Promise<void> {
	const session = await resolveRequestSession(context);
	if (!session || Reflect.get(session.user, 'role') !== SystemRole.ADMIN) {
		return;
	}
	await assertAdminSecondFactor(context, session);
	const targetUserId: unknown = context.body?.userId;
	if (
		context.path === AUTH_PATH.ADMIN_REMOVE_USER &&
		typeof targetUserId === 'string'
	) {
		await assertAccountDeletable(ownership, targetUserId);
	}
}

async function assertAdminSecondFactor(
	context: AuthMiddlewareContext,
	session: AuthSession
): Promise<void> {
	const verified = await hasVerifiedSecondFactor({
		session: session.session,
		twoFactorEnabled: Reflect.get(session.user, 'twoFactorEnabled'),
		countPasskeys: () =>
			context.context.adapter.count({
				model: PASSKEY_MODEL,
				where: [{ field: 'userId', value: session.user.id }],
			}),
	});
	if (verified) return;
	throw APIError.from('FORBIDDEN', {
		code: ADMIN_MFA_REQUIRED_CODE,
		message: ADMIN_MFA_REQUIRED_MESSAGE,
	});
}

async function markSecondFactorVerified(
	context: AuthMiddlewareContext
): Promise<void> {
	const verified =
		context.context.newSession ?? (await getSessionFromCtx(context));
	if (!verified) return;
	await context.context.internalAdapter.updateSession(verified.session.token, {
		[SECOND_FACTOR_VERIFIED_AT_FIELD]: new Date(),
	});
}

function revokedApiKeyId(context: AuthMiddlewareContext): string | null {
	const keyId: unknown = context.body?.keyId;
	if (typeof keyId !== 'string') return null;
	if (context.path === AUTH_PATH.API_KEY_DELETE) return keyId;
	return context.path === AUTH_PATH.API_KEY_UPDATE &&
		context.body?.enabled === false
		? keyId
		: null;
}
