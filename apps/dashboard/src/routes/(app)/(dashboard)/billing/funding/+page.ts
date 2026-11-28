/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redirect } from '@sveltejs/kit';
import {
	FUNDING_DIALOG_PARAM,
	FundingDialog,
} from '#lib/routing/funding-dialog.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

const PERMANENT_REDIRECT = 308;

export const load: PageLoad = ({ url }) => {
	const search = new URLSearchParams(url.search);
	if (!search.has(FUNDING_DIALOG_PARAM)) {
		search.set(FUNDING_DIALOG_PARAM, FundingDialog.Deposit);
	}
	redirect(PERMANENT_REDIRECT, `${resolve(Path.BILLING)}?${search}`);
};
