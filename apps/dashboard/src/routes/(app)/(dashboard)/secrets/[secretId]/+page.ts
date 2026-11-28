/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redirect } from '@sveltejs/kit';
import { SECRET_PANEL_PARAM } from '#lib/features/secrets/lib/secrets-list.ts';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

const PERMANENT_REDIRECT_STATUS = 308;

export const load: PageLoad = ({ params }) => {
	const search = new URLSearchParams({ [SECRET_PANEL_PARAM]: params.secretId });
	redirect(
		PERMANENT_REDIRECT_STATUS,
		`${resolve('/(app)/(dashboard)/secrets')}?${search}`
	);
};
