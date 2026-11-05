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
import { EntityManager } from '@mikro-orm/postgresql';
import { ORGANIZATION_CONTEXT_HEADER } from '@snapflow/organization-access';
import { type ExtendedError, Server, Socket } from 'socket.io';
import { AuthMethod } from '../../../auth/constants/auth-method.constants';
import {
	AuthAddonService,
	type AuthenticationResult,
	type AuthSessionPayload,
} from '../../../auth/services/auth-addon.service';
import { fakeInstance, fakeValue } from '../../../common/testing/instance.fake';
import {
	AUTH_CREDENTIAL_TYPES,
	type OrganizationAuthContext,
} from '../../../common/types/organization-auth-context.types';
import { PLATFORM_PRINCIPAL_TYPE } from '../../../common/types/platform-principal.types';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ORGANIZATION_ERROR } from '../../../organization/constants/organization-errors.constants';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { NotificationConnectionsService } from '../../transport/services/notification-connections.service';
import { NotificationRedisService } from '../../transport/services/notification-redis.service';
import { NotificationGateway } from './notification.gateway';

const TRUSTED_ORIGIN = 'https://app.snapflow.test';
const ACTIVE_ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const OTHER_ORGANIZATION_ID = '7a000000-0000-4000-8000-000000000007';

type Middleware = Parameters<Server['use']>[0];

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

const session: AuthenticationResult = {
	method: AuthMethod.SESSION,
	user: member,
	authSession: fakeValue<AuthSessionPayload>({}),
	activeOrganizationReset: false,
};

function handshakeMiddleware(): Middleware {
	const gateway = new NotificationGateway(
		fakeInstance(EntityManager, {
			name: 'default',
			fork: () => fakeInstance(EntityManager),
		}),
		fakeInstance(AuthAddonService, {
			getSessionAuthContext: async () => session,
		}),
		fakeInstance(TypedConfigService, { get: () => [TRUSTED_ORIGIN] }),
		new NotificationConnectionsService(),
		fakeInstance(NotificationRedisService)
	);
	const registered: Middleware[] = [];
	const server = fakeInstance(Server, {
		use: (middleware: Middleware) => {
			registered.push(middleware);
			return server;
		},
	});
	gateway.afterInit(server);
	const [middleware] = registered;
	assert.ok(middleware);
	return middleware;
}

function handshakeSocket(auth: Record<string, string>): Socket {
	return fakeInstance(Socket, {
		handshake: { auth, headers: { origin: TRUSTED_ORIGIN } },
		request: { headers: {} },
		conn: { once: () => undefined },
		connected: true,
		join: async () => undefined,
	});
}

function handshake(socket: Socket): Promise<ExtendedError | undefined> {
	const middleware = handshakeMiddleware();
	return new Promise((resolve) => middleware(socket, resolve));
}

describe('NotificationGateway handshake', () => {
	it('admits a session that asserts its active organization', async () => {
		const socket = handshakeSocket({
			[ORGANIZATION_CONTEXT_HEADER]: ACTIVE_ORGANIZATION_ID,
		});

		assert.equal(await handshake(socket), undefined);
		socket.data.stopRevalidation();
		socket.data.releaseConnection();
	});

	it('rejects a session that asserts an organization it left', async () => {
		const error = await handshake(
			handshakeSocket({ [ORGANIZATION_CONTEXT_HEADER]: OTHER_ORGANIZATION_ID })
		);

		assert.deepEqual(error?.data, ORGANIZATION_ERROR.CONTEXT_CHANGED);
	});
});
