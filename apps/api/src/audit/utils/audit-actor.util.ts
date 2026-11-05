/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BaseAuthContext } from '../../common/types/base-auth-context.types';
import { isHealthCheckAuthContext } from '../../common/types/health-check-auth-context.types';
import { isMachineAuthContext } from '../../common/types/machine-auth-context.types';
import {
	AUTH_CREDENTIAL_TYPES,
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import {
	AUDIT_ACTOR_TYPE,
	AUDIT_CREDENTIAL_TYPE,
	type AuditCredentialType,
} from '../constants/audit-principal.constants';
import type { AuditActor } from '../types/audit-actor.types';

const AUDIT_CREDENTIAL_TYPE_BY_AUTH_CREDENTIAL_TYPE: Record<
	OrganizationAuthContext['credential']['type'],
	AuditCredentialType
> = {
	[AUTH_CREDENTIAL_TYPES.SESSION]: AUDIT_CREDENTIAL_TYPE.SESSION,
	[AUTH_CREDENTIAL_TYPES.API_KEY]: AUDIT_CREDENTIAL_TYPE.API_KEY,
};

export function auditActorFromContext(context: BaseAuthContext): AuditActor {
	if (isOrganizationAuthContext(context)) {
		return {
			actorType: AUDIT_ACTOR_TYPE.HUMAN,
			actorId: context.principal.id,
			actorDisplayName: context.principal.displayName,
			actorEmail: context.principal.email,
			credentialType:
				AUDIT_CREDENTIAL_TYPE_BY_AUTH_CREDENTIAL_TYPE[context.credential.type],
			credentialId: context.credential.id,
		};
	}
	if (isMachineAuthContext(context)) {
		return {
			actorType: AUDIT_ACTOR_TYPE.MACHINE,
			actorId: context.machineId,
			actorDisplayName: context.machine.name,
			credentialType: AUDIT_CREDENTIAL_TYPE.MACHINE_DPOP,
		};
	}
	if (isHealthCheckAuthContext(context)) {
		return {
			actorType: AUDIT_ACTOR_TYPE.HEALTH_CHECK,
			actorId: AUDIT_ACTOR_TYPE.HEALTH_CHECK,
			credentialType: AUDIT_CREDENTIAL_TYPE.HEALTH_KEY,
		};
	}
	return {
		actorType: AUDIT_ACTOR_TYPE.SYSTEM,
		actorId: String(context.role),
		credentialType: AUDIT_CREDENTIAL_TYPE.SYSTEM,
	};
}

export function auditOrganizationFromContext(
	context: BaseAuthContext
): string | undefined {
	if (isOrganizationAuthContext(context)) return context.organizationId;
	if (isMachineAuthContext(context)) {
		return context.machine.organizationId ?? undefined;
	}
	return undefined;
}
