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
import {
	ConflictException,
	ForbiddenException,
	HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ORGANIZATION_CONTEXT_HEADER } from '@snapflow/organization-access';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { fakeInstance, fakeValue } from '../../common/testing/instance.fake';
import {
	AUTH_CREDENTIAL_TYPES,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { PLATFORM_PRINCIPAL_TYPE } from '../../common/types/platform-principal.types';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ORGANIZATION_ERROR } from '../../organization/tenant/constants/organization-errors.constants';
import { OrganizationService } from '../../organization/tenant/services/organization.service';
import { SystemRole } from '../../user/enums/system-role.enum';
import { AUTH_ERROR } from '../constants/auth-errors.constants';
import { AuthMethod } from '../constants/auth-method.constants';
import { SESSION_FRESH_AGE_SECONDS } from '../constants/auth-security.constants';
import { RequireFreshSession } from '../decorators/require-fresh-session.decorator';
import {
	AuthAddonService,
	type AuthenticationResult,
	type AuthSessionPayload,
} from '../services/auth-addon.service';
import { OrganizationAccessService } from '../services/organization-access.service';
import { SnapflowAuthGuard } from './auth.guard';

const ACTIVE_ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const OTHER_ORGANIZATION_ID = '7a000000-0000-4000-8000-000000000007';
const STALE_SESSION_AGE_MILLISECONDS =
	(SESSION_FRESH_AGE_SECONDS + 1) * MILLISECONDS_PER_SECOND;

class ProbeController {
	read(): void {}

	@RequireFreshSession()
	mintCredential(): void {}
}

const member: OrganizationAuthContext = {
	role: SystemRole.USER,
	principal: {
		type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
		id: 'member-user',
		email: 'member@snapflow.test',
		displayName: 'Member',
		systemRole: SystemRole.USER,
	},
	userId: 'member-user',
	email: 'member@snapflow.test',
	organizationId: ACTIVE_ORGANIZATION_ID,
	memberId: 'member',
	memberRoles: [],
	credential: { type: AUTH_CREDENTIAL_TYPES.SESSION, id: 'member-session' },
};

function sessionResult(sessionCreatedAt = new Date()): AuthenticationResult {
	return {
		method: AuthMethod.SESSION,
		user: member,
		authSession: fakeValue<AuthSessionPayload>({
			user: { id: member.userId },
			session: { createdAt: sessionCreatedAt },
		}),
		activeOrganizationReset: false,
	};
}

const apiKeyResult: AuthenticationResult = {
	method: AuthMethod.API_KEY,
	user: {
		...member,
		credential: {
			type: AUTH_CREDENTIAL_TYPES.API_KEY,
			id: 'key',
			name: 'key',
			permissions: {},
		},
	},
};

function guardFor(result: AuthenticationResult): SnapflowAuthGuard {
	return new SnapflowAuthGuard(
		new Reflector(),
		fakeInstance(AuthAddonService, { authenticate: async () => result }),
		fakeInstance(OrganizationAccessService),
		fakeInstance(OrganizationService),
		fakeInstance(TypedConfigService)
	);
}

function readRequest(
	headers: Record<string, string>,
	handler: keyof ProbeController = 'read'
): ExecutionContextHost {
	return new ExecutionContextHost(
		[{ method: 'GET', headers }],
		ProbeController,
		ProbeController.prototype[handler]
	);
}

function rejectsWith(
	expected: abstract new (...args: never[]) => HttpException,
	body: { code: string; message: string }
) {
	return (error: unknown) => {
		assert.ok(error instanceof expected);
		assert.deepEqual(error.getResponse(), body);
		return true;
	};
}

describe('SnapflowAuthGuard organization context', () => {
	it('admits a session request that asserts the active organization', async () => {
		assert.equal(
			await guardFor(sessionResult()).canActivate(
				readRequest({ [ORGANIZATION_CONTEXT_HEADER]: ACTIVE_ORGANIZATION_ID })
			),
			true
		);
	});

	it('admits a session request that asserts no organization', async () => {
		assert.equal(
			await guardFor(sessionResult()).canActivate(readRequest({})),
			true
		);
	});

	it('rejects a read that asserts an organization the session left', async () => {
		await assert.rejects(
			guardFor(sessionResult()).canActivate(
				readRequest({ [ORGANIZATION_CONTEXT_HEADER]: OTHER_ORGANIZATION_ID })
			),
			rejectsWith(ConflictException, ORGANIZATION_ERROR.CONTEXT_CHANGED)
		);
	});

	it('ignores the asserted organization of an API key request', async () => {
		assert.equal(
			await guardFor(apiKeyResult).canActivate(
				readRequest({ [ORGANIZATION_CONTEXT_HEADER]: OTHER_ORGANIZATION_ID })
			),
			true
		);
	});
});

describe('SnapflowAuthGuard fresh sessions', () => {
	it('admits a recently created session', async () => {
		assert.equal(
			await guardFor(sessionResult()).canActivate(
				readRequest({}, 'mintCredential')
			),
			true
		);
	});

	it('rejects a session older than the fresh age', async () => {
		await assert.rejects(
			guardFor(
				sessionResult(new Date(Date.now() - STALE_SESSION_AGE_MILLISECONDS))
			).canActivate(readRequest({}, 'mintCredential')),
			rejectsWith(ForbiddenException, AUTH_ERROR.FRESH_SESSION_REQUIRED)
		);
	});

	it('rejects an API key', async () => {
		await assert.rejects(
			guardFor(apiKeyResult).canActivate(readRequest({}, 'mintCredential')),
			rejectsWith(ForbiddenException, AUTH_ERROR.FRESH_SESSION_REQUIRED)
		);
	});
});

const TRUSTED_ORIGIN = 'https://snapflow.io';
const SANDBOX_ORIGIN = 'https://3000-sandbox.snapflow.run';

function originGuardFor(result: AuthenticationResult): SnapflowAuthGuard {
	return new SnapflowAuthGuard(
		new Reflector(),
		fakeInstance(AuthAddonService, { authenticate: async () => result }),
		fakeInstance(OrganizationAccessService),
		fakeInstance(OrganizationService),
		fakeInstance(TypedConfigService, { get: () => [TRUSTED_ORIGIN] })
	);
}

function writeRequest(headers: Record<string, string>): ExecutionContextHost {
	return new ExecutionContextHost(
		[
			{
				method: 'POST',
				headers,
				get: (name: string) => headers[name.toLowerCase()],
			},
		],
		ProbeController,
		ProbeController.prototype.read
	);
}

describe('SnapflowAuthGuard session request origin', () => {
	it('admits a write from a trusted origin', async () => {
		assert.equal(
			await originGuardFor(sessionResult()).canActivate(
				writeRequest({ origin: TRUSTED_ORIGIN })
			),
			true
		);
	});

	it('rejects a write from a sandbox origin', async () => {
		await assert.rejects(
			originGuardFor(sessionResult()).canActivate(
				writeRequest({ origin: SANDBOX_ORIGIN })
			),
			ForbiddenException
		);
	});

	for (const fetchSite of ['same-origin', 'none']) {
		it(`admits an origin-less write with Sec-Fetch-Site ${fetchSite}`, async () => {
			assert.equal(
				await originGuardFor(sessionResult()).canActivate(
					writeRequest({ 'sec-fetch-site': fetchSite })
				),
				true
			);
		});
	}

	for (const fetchSite of ['same-site', 'cross-site']) {
		it(`rejects an origin-less write with Sec-Fetch-Site ${fetchSite}`, async () => {
			await assert.rejects(
				originGuardFor(sessionResult()).canActivate(
					writeRequest({ 'sec-fetch-site': fetchSite })
				),
				ForbiddenException
			);
		});
	}

	it('admits an origin-less write without fetch metadata', async () => {
		assert.equal(
			await originGuardFor(sessionResult()).canActivate(writeRequest({})),
			true
		);
	});

	it('does not apply origin rules to API keys', async () => {
		assert.equal(
			await originGuardFor(apiKeyResult).canActivate(
				writeRequest({ origin: SANDBOX_ORIGIN })
			),
			true
		);
	});
});
