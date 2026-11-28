/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiErrorCode } from '@snapflow/api-client';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';

function isSessionNotFresh(error: unknown): boolean {
	return hasErrorCode(error, ApiErrorCode.SessionNotFresh);
}

class Reauthentication {
	requested = $state(false);

	request = (): void => {
		this.requested = true;
	};

	requestIfNotFresh = (error: unknown): void => {
		if (isSessionNotFresh(error)) this.request();
	};

	dismiss = (): void => {
		this.requested = false;
	};
}

export const reauthentication = new Reauthentication();
