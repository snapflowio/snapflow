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
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ORGANIZATION_ROLE } from '@snapflow/organization-access';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { fakeInstance, fakeValue } from '../../common/testing/instance.fake';
import {
	AUTH_CREDENTIAL_TYPES,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { PLATFORM_PRINCIPAL_TYPE } from '../../common/types/platform-principal.types';
import {
	ADMIN_MFA_REQUIRED_CODE,
	ADMIN_MFA_REQUIRED_MESSAGE,
} from '../../user/constants/admin-access.constants';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import { AdminMfaRequiredException } from '../../user/exceptions/admin-mfa-required.exception';
import {
	AuthAddonService,
	type AuthSessionPayload,
} from '../services/auth-addon.service';
import { SystemActionGuard } from './system-action.guard';

const ROUTE_RESULT = 'ok';

@RequiredSystemRole(SystemRole.ADMIN)
class AdminRoutes {
	list(): string {
		return ROUTE_RESULT;
	}

	@RequiredSystemRole([SystemRole.ADMIN, SystemRole.USER])
	widened(): string {
		return ROUTE_RESULT;
	}
}

class OpenRoutes {
	read(): string {
		return ROUTE_RESULT;
	}
}

const ORGANIZATION_ID = 'organization-1';
const MEMBER_ID = 'member-1';

function principal(
	role: SystemRole,
	credentialType: OrganizationAuthContext['credential']['type']
): OrganizationAuthContext {
	const userId = `${role}-user`;
	const email = `${role}@snapflow.test`;
	const credential: OrganizationAuthContext['credential'] =
		credentialType === AUTH_CREDENTIAL_TYPES.SESSION
			? { type: credentialType, id: 'session-1' }
			: {
					type: credentialType,
					id: 'key-1',
					name: 'key',
					permissions: {},
				};
	return {
		role,
		principal: {
			type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
			id: userId,
			email,
			displayName: role,
			systemRole: role,
		},
		userId,
		email,
		organizationId: ORGANIZATION_ID,
		memberId: MEMBER_ID,
		memberRoles: [ORGANIZATION_ROLE.OWNER],
		credential,
	};
}

function guardWithSecondFactor(hasSecondFactor: boolean): {
	guard: SystemActionGuard;
	lookups: () => number;
} {
	let lookupCount = 0;
	const authAddonService = fakeInstance(AuthAddonService, {
		hasVerifiedSecondFactor: async () => {
			lookupCount += 1;
			return hasSecondFactor;
		},
	});
	return {
		guard: new SystemActionGuard(new Reflector(), authAddonService),
		lookups: () => lookupCount,
	};
}

function context(
	user: OrganizationAuthContext,
	controller: typeof AdminRoutes | typeof OpenRoutes,
	handler: () => string
): ExecutionContextHost {
	const request = {
		user,
		authSession:
			user.credential.type === AUTH_CREDENTIAL_TYPES.SESSION
				? fakeValue<AuthSessionPayload>({ user: { id: user.userId } })
				: undefined,
		headers: {},
	};
	return new ExecutionContextHost([request], controller, handler);
}

const adminSession = principal(SystemRole.ADMIN, AUTH_CREDENTIAL_TYPES.SESSION);
const userSession = principal(SystemRole.USER, AUTH_CREDENTIAL_TYPES.SESSION);
const adminApiKey = principal(SystemRole.ADMIN, AUTH_CREDENTIAL_TYPES.API_KEY);

describe('SystemActionGuard', () => {
	it('admits any caller to routes without a role requirement', async () => {
		const { guard, lookups } = guardWithSecondFactor(false);

		assert.equal(
			await guard.canActivate(
				context(adminSession, OpenRoutes, OpenRoutes.prototype.read)
			),
			true
		);
		assert.equal(lookups(), 0);
	});

	it('denies non-admin callers on admin routes', async () => {
		const { guard } = guardWithSecondFactor(true);

		await assert.rejects(
			guard.canActivate(
				context(userSession, AdminRoutes, AdminRoutes.prototype.list)
			),
			AccessDeniedException
		);
	});

	it('never lets a handler-level role widen the controller requirement', async () => {
		const { guard } = guardWithSecondFactor(true);

		await assert.rejects(
			guard.canActivate(
				context(userSession, AdminRoutes, AdminRoutes.prototype.widened)
			),
			AccessDeniedException
		);
	});

	it('denies admin access through API keys', async () => {
		const { guard } = guardWithSecondFactor(true);

		await assert.rejects(
			guard.canActivate(
				context(adminApiKey, AdminRoutes, AdminRoutes.prototype.list)
			),
			AccessDeniedException
		);
	});

	it('requires a second factor for admin sessions', async () => {
		const { guard } = guardWithSecondFactor(false);

		await assert.rejects(
			guard.canActivate(
				context(adminSession, AdminRoutes, AdminRoutes.prototype.list)
			),
			(error: unknown) => {
				assert.ok(error instanceof AdminMfaRequiredException);
				assert.deepEqual(error.getResponse(), {
					code: ADMIN_MFA_REQUIRED_CODE,
					message: ADMIN_MFA_REQUIRED_MESSAGE,
				});
				return true;
			}
		);
	});

	it('admits admin sessions holding a second factor', async () => {
		const { guard, lookups } = guardWithSecondFactor(true);

		assert.equal(
			await guard.canActivate(
				context(adminSession, AdminRoutes, AdminRoutes.prototype.list)
			),
			true
		);
		assert.equal(lookups(), 1);
	});
});
