/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redirect } from '@sveltejs/kit';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

const TEMPORARY_REDIRECT = 307;

export const load: PageLoad = () => {
	redirect(TEMPORARY_REDIRECT, resolve(Path.ADMIN_SETTINGS));
};
