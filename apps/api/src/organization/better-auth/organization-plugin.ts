/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ORGANIZATION_ADDITIONAL_FIELDS,
	ORGANIZATION_CUSTOM_ROLE_LIMIT,
	ORGANIZATION_MEMBERSHIP_LIMIT,
	ORGANIZATION_ROLE,
	ORGANIZATION_ROLE_ADDITIONAL_FIELDS,
	ORGANIZATION_ROLES,
	organizationAccessControl,
} from '@snapflow/organization-access';
import {
	type OrganizationOptions,
	organization,
} from 'better-auth/plugins/organization';
import { sendOrThrowApiError } from '../../auth/better-auth/email/email-delivery-api-error';
import type { EmailService } from '../../infra/email/services/email.service';
import {
	ORGANIZATION_INVITATION_PATH,
	ORGANIZATION_INVITATION_TTL_SECONDS,
	ORGANIZATION_PENDING_INVITATION_LIMIT,
} from '../constants/organization.constants';
import type { OrganizationService } from '../services/organization.service';
import { organizationAccess } from './organization-access-plugin';
import {
	createOrganizationHooks,
	type OrganizationHookDependencies,
} from './organization-hooks';

export interface OrganizationPluginDependencies
	extends OrganizationHookDependencies {
	organizations: OrganizationHookDependencies['organizations'] &
		Pick<OrganizationService, 'hasReachedCreationLimit'>;
	emailService: Pick<EmailService, 'sendOrganizationInvitation'>;
	dashboardUrl: string;
}

export function createOrganizationPlugins(
	dependencies: OrganizationPluginDependencies
) {
	const { organizations, emailService, dashboardUrl } = dependencies;
	const options = {
		ac: organizationAccessControl,
		roles: ORGANIZATION_ROLES,
		creatorRole: ORGANIZATION_ROLE.OWNER,
		allowUserToCreateOrganization: (user) => user.emailVerified,
		organizationLimit: (user) => organizations.hasReachedCreationLimit(user.id),
		membershipLimit: ORGANIZATION_MEMBERSHIP_LIMIT,
		invitationExpiresIn: ORGANIZATION_INVITATION_TTL_SECONDS,
		invitationLimit: ORGANIZATION_PENDING_INVITATION_LIMIT,
		cancelPendingInvitationsOnReInvite: true,
		disableOrganizationDeletion: true,
		requireEmailVerificationOnInvitation: true,
		sendInvitationEmail: ({ id, email, organization, inviter, invitation }) =>
			sendOrThrowApiError(() =>
				emailService.sendOrganizationInvitation({
					invitationId: id,
					recipient: email,
					organizationName: organization.name,
					invitedBy: inviter.user.name || inviter.user.email,
					invitationUrl: `${dashboardUrl}${ORGANIZATION_INVITATION_PATH}/${id}`,
					expiresAt: invitation.expiresAt,
				})
			),
		dynamicAccessControl: {
			enabled: true,
			maximumRolesPerOrganization: ORGANIZATION_CUSTOM_ROLE_LIMIT,
		},
		schema: {
			organization: { additionalFields: ORGANIZATION_ADDITIONAL_FIELDS },
			organizationRole: {
				additionalFields: ORGANIZATION_ROLE_ADDITIONAL_FIELDS,
			},
		},
		organizationHooks: createOrganizationHooks(dependencies),
	} satisfies OrganizationOptions;

	return [organization(options), organizationAccess(options)] as const;
}
