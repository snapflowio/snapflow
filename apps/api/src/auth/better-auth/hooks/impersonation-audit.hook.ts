/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HttpStatus } from '@nestjs/common';
import type { GenericEndpointContext } from 'better-auth';
import { getIP } from 'better-auth/api';
import {
	AUDIT_ACTOR_TYPE,
	AUDIT_CREDENTIAL_TYPE,
} from '../../../audit/log/constants/audit-principal.constants';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import type { AuditService } from '../../../audit/log/services/audit.service';
import { AUTH_PATH } from '../../constants/auth-paths.constants';

const USER_AGENT_HEADER = 'user-agent';

const IMPERSONATION_ACTION_BY_PATH: Readonly<Record<string, AuditAction>> = {
	[AUTH_PATH.ADMIN_IMPERSONATE_USER]: AuditAction.IMPERSONATE,
	[AUTH_PATH.ADMIN_STOP_IMPERSONATING]: AuditAction.STOP_IMPERSONATING,
};

export async function auditImpersonation(
	auditService: AuditService,
	session: { id: string; userId: string; impersonatedBy?: unknown },
	context: GenericEndpointContext | null
): Promise<void> {
	const action = context ? IMPERSONATION_ACTION_BY_PATH[context.path] : null;
	const administratorId = session.impersonatedBy;
	if (!context || !action || typeof administratorId !== 'string') return;
	const administrator =
		await context.context.internalAdapter.findUserById(administratorId);
	await auditService.createCompletedLog({
		actorType: AUDIT_ACTOR_TYPE.HUMAN,
		actorId: administratorId,
		actorDisplayName: administrator?.name,
		actorEmail: administrator?.email,
		credentialType: AUDIT_CREDENTIAL_TYPE.SESSION,
		credentialId: session.id,
		userId: administratorId,
		action,
		targetType: AuditTarget.USER,
		targetId: session.userId,
		statusCode: HttpStatus.OK,
		ipAddress: context.request
			? (getIP(context.request, context.context.options) ?? undefined)
			: undefined,
		userAgent: context.request?.headers.get(USER_AGENT_HEADER) ?? undefined,
	});
}
