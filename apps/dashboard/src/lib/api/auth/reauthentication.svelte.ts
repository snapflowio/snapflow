/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const SESSION_NOT_FRESH_CODE = 'SESSION_NOT_FRESH';

function isSessionNotFresh(error: unknown): boolean {
	return SnapflowError.fromUnknown(error).code === SESSION_NOT_FRESH_CODE;
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
