/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import { SandboxErrorCode } from '../enums/sandbox-error-code.enum';

const STATE_CHANGE_IN_PROGRESS_MESSAGE =
	'The sandbox is already changing state. Wait for the current change to finish, then try again.';

export class StateChangeInProgressException extends ConflictException {
	constructor(message = STATE_CHANGE_IN_PROGRESS_MESSAGE) {
		super({ code: SandboxErrorCode.STATE_CHANGE_IN_PROGRESS, message });
	}
}
