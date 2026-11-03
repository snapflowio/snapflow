/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { BetterAuthOptions } from 'better-auth';
import type { AuditService } from '../../../audit/log/services/audit.service';
import { softDeleteOrganization } from '../../../organization/tenant/better-auth/organization-deletion';
import type { OrganizationService } from '../../../organization/tenant/services/organization.service';
import type { OrganizationSuspensionService } from '../../../organization/tenant/services/organization-suspension.service';
import type { PersonalOrganizationService } from '../../../organization/tenant/services/personal-organization.service';
import { UserEvents } from '../../../user/constants/user-events.constants';
import { UserBannedEvent } from '../../../user/events/user-banned.event';
import type { UserService } from '../../../user/services/user.service';
import { isBanActive } from '../../../user/utils/user-ban.util';
import { AuthEvents } from '../../constants/auth-events.constants';
import { AUTH_PATH } from '../../constants/auth-paths.constants';
import { SessionRevokedEvent } from '../../events/session-revoked.event';
import { SECOND_FACTOR_VERIFIED_AT_FIELD } from '../schema/additional-fields';
import { auditImpersonation } from './impersonation-audit.hook';

export interface AuthDatabaseHookDependencies {
	auditService: AuditService;
	eventEmitter: EventEmitter2;
	organizations: Pick<
		OrganizationService,
		'resolveInitialActiveOrganizationId'
	>;
	personalOrganizations: Pick<
		PersonalOrganizationService,
		'ensure' | 'find' | 'liftEmailVerificationSuspension'
	>;
	suspensions: Pick<OrganizationSuspensionService, 'liftOwnerBanSuspensions'>;
	userService: UserService;
}

export function createAuthDatabaseHooks({
	auditService,
	eventEmitter,
	organizations,
	personalOrganizations,
	suspensions,
	userService,
}: AuthDatabaseHookDependencies): NonNullable<
	BetterAuthOptions['databaseHooks']
> {
	return {
		session: {
			create: {
				before: async (session, context) => ({
					data: {
						...session,
						activeOrganizationId:
							await organizations.resolveInitialActiveOrganizationId(
								session.userId
							),
						...(context?.path === AUTH_PATH.PASSKEY_VERIFY_AUTHENTICATION && {
							[SECOND_FACTOR_VERIFIED_AT_FIELD]: new Date(),
						}),
					},
				}),
				after: (session, context) =>
					auditImpersonation(auditService, session, context),
			},
			delete: {
				after: async (session, context) => {
					await eventEmitter.emitAsync(
						AuthEvents.SESSION_REVOKED,
						new SessionRevokedEvent(session.id)
					);
					await auditImpersonation(auditService, session, context);
				},
			},
		},
		user: {
			create: {
				after: async (user) => {
					await userService.completeAuthenticationProvisioning(user.id);
					await personalOrganizations.ensure(user.id);
				},
			},
			update: {
				before: async (data) =>
					typeof data.banned === 'boolean'
						? { data: { ...data, bannedAt: data.banned ? new Date() : null } }
						: undefined,
				after: async (user) => {
					if (user.emailVerified) {
						await personalOrganizations.liftEmailVerificationSuspension(
							user.id
						);
					}
					if (isBanActive(toBanState(user))) {
						await eventEmitter.emitAsync(
							UserEvents.BANNED,
							new UserBannedEvent(user.id)
						);
						return;
					}
					await suspensions.liftOwnerBanSuspensions(user.id);
				},
			},
			delete: {
				before: async (user, context) => {
					const personal = await personalOrganizations.find(user.id);
					if (!personal) return;
					if (!context) {
						throw new Error(
							'Account deletion must run inside a Better Auth endpoint'
						);
					}
					await softDeleteOrganization(
						context.context,
						eventEmitter,
						personal.id
					);
				},
				after: async (user) => userService.notifyAuthenticationDeleted(user.id),
			},
		},
	};
}

function toBanState(user: Record<string, unknown>): {
	banned: boolean;
	banExpires: Date | null;
} {
	const banExpires = user.banExpires;
	return {
		banned: user.banned === true,
		banExpires: banExpires ? new Date(String(banExpires)) : null,
	};
}
