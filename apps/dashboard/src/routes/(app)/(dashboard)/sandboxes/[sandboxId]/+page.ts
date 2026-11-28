/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redirect } from '@sveltejs/kit';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import { loadOrganizationPermission } from '#lib/features/organizations/lib/load-permission.ts';
import { firstSandboxContentTabHref } from '#lib/features/sandboxes/lib/sandbox-detail-tabs.ts';
import type { PageLoad } from './$types';

const TEMPORARY_REDIRECT_STATUS = 307;

export const load: PageLoad = async ({ params, parent }) => {
	if (!window.matchMedia(breakpointQuery('lg')).matches) return;
	const { queryClient, session } = await parent();
	const canWrite = await loadOrganizationPermission(
		queryClient,
		session?.session.activeOrganizationId ?? null,
		{ sandboxes: ['write'] }
	);
	redirect(
		TEMPORARY_REDIRECT_STATUS,
		firstSandboxContentTabHref(params.sandboxId, canWrite)
	);
};
