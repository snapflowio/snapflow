/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { getSessionFromCtx } from 'better-auth/api';
import type { AuthMiddlewareContext } from '../../../auth/better-auth/hooks/request-session';
import { ORGANIZATION_ERROR } from '../constants/organization-errors.constants';
import { OrganizationEvents } from '../constants/organization-events.constants';
import { OrganizationActiveChangedEvent } from '../events/organization-active-changed.event';
import { OrganizationMembershipChangedEvent } from '../events/organization-membership-changed.event';
import { OrganizationRolesChangedEvent } from '../events/organization-roles-changed.event';
import type { OrganizationService } from '../services/organization.service';
import {
	assertNotPersonal,
	loadOrganization,
	type OrganizationHookDependencies,
} from './organization-hooks';

export const ORGANIZATION_AUTH_PATH = {
	LEAVE: '/organization/leave',
	SET_ACTIVE: '/organization/set-active',
	UPDATE_ROLE: '/organization/update-role',
	DELETE_ROLE: '/organization/delete-role',
} as const;

const ROLE_DEFINITION_PATHS: ReadonlySet<string> = new Set([
	ORGANIZATION_AUTH_PATH.UPDATE_ROLE,
	ORGANIZATION_AUTH_PATH.DELETE_ROLE,
]);

const ACTIVE_ORGANIZATION_FIELD = 'activeOrganizationId';

export interface OrganizationAuthHookDependencies
	extends OrganizationHookDependencies {
	organizations: OrganizationHookDependencies['organizations'] &
		Pick<
			OrganizationService,
			'recordLastActiveOrganization' | 'resolveMembership'
		>;
}

export async function guardOrganizationRequest(
	context: AuthMiddlewareContext,
	dependencies: OrganizationAuthHookDependencies
): Promise<void> {
	const organizationId = stringField(context.body, 'organizationId');
	if (!organizationId || context.path !== ORGANIZATION_AUTH_PATH.LEAVE) return;
	assertNotPersonal(
		await loadOrganization(dependencies.organizations, organizationId),
		ORGANIZATION_ERROR.PERSONAL_ORGANIZATION_UNLEAVABLE
	);
}

export async function handleOrganizationResponse(
	context: AuthMiddlewareContext,
	{ organizations, eventEmitter }: OrganizationAuthHookDependencies
): Promise<void> {
	const isRoleDefinitionChange = ROLE_DEFINITION_PATHS.has(context.path);
	if (
		context.path !== ORGANIZATION_AUTH_PATH.SET_ACTIVE &&
		context.path !== ORGANIZATION_AUTH_PATH.LEAVE &&
		!isRoleDefinitionChange
	) {
		return;
	}
	const session = await getSessionFromCtx(context);
	if (!session) return;

	if (context.path === ORGANIZATION_AUTH_PATH.SET_ACTIVE) {
		const selectedOrganizationId = stringField(context.context.returned, 'id');
		await organizations.recordLastActiveOrganization(
			session.user.id,
			selectedOrganizationId
		);
		const { organizationId } = await organizations.resolveMembership(
			session.user.id,
			selectedOrganizationId
		);
		await eventEmitter.emitAsync(
			OrganizationEvents.ACTIVE_CHANGED,
			new OrganizationActiveChangedEvent(
				session.user.id,
				session.session.id,
				organizationId
			)
		);
		return;
	}
	const organizationId =
		stringField(context.body, 'organizationId') ??
		stringField(session.session, ACTIVE_ORGANIZATION_FIELD);
	if (!organizationId) return;
	if (isRoleDefinitionChange) {
		await eventEmitter.emitAsync(
			OrganizationEvents.ROLES_CHANGED,
			new OrganizationRolesChangedEvent(organizationId)
		);
		return;
	}
	await eventEmitter.emitAsync(
		OrganizationEvents.MEMBERSHIP_CHANGED,
		new OrganizationMembershipChangedEvent(organizationId, session.user.id)
	);
}

function stringField(value: unknown, key: string): string | null {
	if (typeof value !== 'object' || value === null) return null;
	const field: unknown = Reflect.get(value, key);
	return typeof field === 'string' ? field : null;
}
