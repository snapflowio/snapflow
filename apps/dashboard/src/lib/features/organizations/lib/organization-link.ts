/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ORGANIZATION_CONTEXT_SEARCH_PARAM } from '@snapflow/organization-access';
import { redirect } from '@sveltejs/kit';
import type { QueryClient } from '@tanstack/svelte-query';
import {
	listOrganizations,
	SWITCH_ORGANIZATION_FAILED_MESSAGE,
	setActiveOrganization,
} from '#lib/api/auth/organization.ts';
import { refreshSession, sessionQueryOptions } from '#lib/api/auth/session.ts';
import { setActiveOrganizationContext } from '#lib/api/client/organization-context.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';

const TEMPORARY_REDIRECT = 307;

const NOT_A_MEMBER_MESSAGE = 'You are not a member of that organization';
const NOT_A_MEMBER_DESCRIPTION =
	'The link points to an organization you cannot access, so you stay in your current one.';

function withoutOrganizationParam(url: URL): string {
	const target = new URL(url);
	target.searchParams.delete(ORGANIZATION_CONTEXT_SEARCH_PARAM);
	return `${target.pathname}${target.search}${target.hash}`;
}

async function selectOrganization(
	queryClient: QueryClient,
	organizationId: string
): Promise<void> {
	try {
		const organizations = await listOrganizations();
		if (!organizations.some(({ id }) => id === organizationId)) {
			toast.error(NOT_A_MEMBER_MESSAGE, {
				description: NOT_A_MEMBER_DESCRIPTION,
				persistAcrossRoutes: true,
			});
			return;
		}
		await setActiveOrganization(organizationId);
	} catch (error) {
		toast.error(SWITCH_ORGANIZATION_FAILED_MESSAGE, {
			description: SnapflowError.fromUnknown(error).message,
			persistAcrossRoutes: true,
		});
		return;
	}
	setActiveOrganizationContext(organizationId);
	await refreshSession(queryClient);
}

export async function followOrganizationLink(
	queryClient: QueryClient,
	url: URL
): Promise<void> {
	const organizationId = url.searchParams.get(
		ORGANIZATION_CONTEXT_SEARCH_PARAM
	);
	if (organizationId === null) return;
	const session = await queryClient.query(sessionQueryOptions());
	if (organizationId !== session?.session.activeOrganizationId) {
		await selectOrganization(queryClient, organizationId);
	}
	redirect(TEMPORARY_REDIRECT, withoutOrganizationParam(url));
}
