/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import { COMMON_ERROR_MESSAGES } from '../../common/constants/api-error-code.constants';
import { CommonErrorCode } from '../../common/enums/common-error-code.enum';

export class JobConflictException extends ConflictException {
	constructor() {
		super({
			code: CommonErrorCode.OPERATION_IN_PROGRESS,
			message: COMMON_ERROR_MESSAGES[CommonErrorCode.OPERATION_IN_PROGRESS],
		});
	}
}
