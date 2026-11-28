/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { adminMfaStepUp } from '#lib/api/admin/mfa-step-up.svelte.ts';
import { isAdminMfaRequired } from './mfa.ts';

const FORBIDDEN_STATUS = 403;

export type Fetcher = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Promise<Response>;

async function readResponseBody(response: Response): Promise<unknown> {
	try {
		return await response.clone().json();
	} catch {
		return null;
	}
}

export function withAdminMfaStepUp(fetcher: Fetcher): Fetcher {
	return async (input, init) => {
		const request = new Request(input, init);
		const response = await fetcher(request.clone());
		if (response.status !== FORBIDDEN_STATUS) return response;
		if (!isAdminMfaRequired(await readResponseBody(response))) return response;
		if (!(await adminMfaStepUp.request())) return response;
		return fetcher(request);
	};
}
