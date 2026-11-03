/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { error } from '@sveltejs/kit';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { machineQueryOptions } from '#lib/api/machines.ts';
import type { LayoutLoad } from './$types';

const NOT_FOUND_STATUS = 404;

function isNotFound(cause: unknown): boolean {
	return cause instanceof SnapflowError && cause.status === NOT_FOUND_STATUS;
}

export const load: LayoutLoad = async ({ params, parent }) => {
	const { queryClient } = await parent();
	try {
		await queryClient.query(machineQueryOptions(params.machineId));
	} catch (cause) {
		if (isNotFound(cause)) error(NOT_FOUND_STATUS, 'Machine not found');
	}
};
