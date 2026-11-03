/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

const PERMANENT_REDIRECT = 308;
const LEGACY_ROW_PARAM = 'row';

export const load: PageLoad = ({ url }) => {
	const machineId = url.searchParams.get(LEGACY_ROW_PARAM);
	if (machineId) {
		redirect(
			PERMANENT_REDIRECT,
			resolve('/(app)/(dashboard)/listings/[machineId]', { machineId })
		);
	}
};
