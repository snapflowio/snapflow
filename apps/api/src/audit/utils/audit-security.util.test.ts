/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { ORGANIZATION_ROLE } from '@snapflow/organization-access';
import {
	AUTH_CREDENTIAL_TYPES,
	type AuthCredential,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { PLATFORM_PRINCIPAL_TYPE } from '../../common/types/platform-principal.types';
import { SystemRole } from '../../user/enums/system-role.enum';
import {
	AUDIT_ACTOR_TYPE,
	AUDIT_CREDENTIAL_TYPE,
} from '../constants/audit-principal.constants';
import {
	auditActorFromContext,
	auditOrganizationFromContext,
} from './audit-actor.util';
import { sanitizeAuditMetadata } from './audit-metadata.util';

const OPERATOR_EMAIL = 'operator@example.test';
const OPERATOR_NAME = 'Operator';

function organizationContext(
	userId: string,
	organizationId: string,
	credential: AuthCredential
): OrganizationAuthContext {
	return {
		role: SystemRole.USER,
		userId,
		email: OPERATOR_EMAIL,
		organizationId,
		memberId: randomUUID(),
		memberRoles: [ORGANIZATION_ROLE.MEMBER],
		principal: {
			type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
			id: userId,
			email: OPERATOR_EMAIL,
			displayName: OPERATOR_NAME,
			systemRole: SystemRole.USER,
		},
		credential,
	};
}

describe('audit security boundaries', () => {
	it('attributes a human session to its principal, credential and organization', () => {
		const userId = randomUUID();
		const organizationId = randomUUID();
		const sessionId = randomUUID();
		const context = organizationContext(userId, organizationId, {
			type: AUTH_CREDENTIAL_TYPES.SESSION,
			id: sessionId,
		});

		assert.deepEqual(auditActorFromContext(context), {
			actorType: AUDIT_ACTOR_TYPE.HUMAN,
			actorId: userId,
			actorDisplayName: OPERATOR_NAME,
			actorEmail: OPERATOR_EMAIL,
			credentialType: AUDIT_CREDENTIAL_TYPE.SESSION,
			credentialId: sessionId,
		});
		assert.equal(auditOrganizationFromContext(context), organizationId);
	});

	it('attributes an API key to its creator, key id and organization', () => {
		const userId = randomUUID();
		const organizationId = randomUUID();
		const apiKeyId = randomUUID();
		const context = organizationContext(userId, organizationId, {
			type: AUTH_CREDENTIAL_TYPES.API_KEY,
			id: apiKeyId,
			name: 'ci',
			permissions: { audit_logs: ['read'] },
		});

		assert.deepEqual(auditActorFromContext(context), {
			actorType: AUDIT_ACTOR_TYPE.HUMAN,
			actorId: userId,
			actorDisplayName: OPERATOR_NAME,
			actorEmail: OPERATOR_EMAIL,
			credentialType: AUDIT_CREDENTIAL_TYPE.API_KEY,
			credentialId: apiKeyId,
		});
		assert.equal(auditOrganizationFromContext(context), organizationId);
	});

	it('removes sensitive metadata recursively without retaining masked copies', () => {
		assert.deepEqual(
			sanitizeAuditMetadata({
				name: 'sandbox',
				secretValue: 'must-not-survive',
				nested: {
					label: 'web',
					authorization: 'must-not-survive',
					items: [{ token: 'must-not-survive', port: 8080 }],
				},
			}),
			{
				name: 'sandbox',
				nested: { label: 'web', items: [{ port: 8080 }] },
			}
		);
	});
});
