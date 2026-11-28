/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ForbiddenException } from '@nestjs/common';
import { COMMON_ERROR_MESSAGES } from '../constants/api-error-code.constants';
import { CommonErrorCode } from '../enums/common-error-code.enum';

export class InvalidAuthenticationContextException extends ForbiddenException {
	constructor() {
		super({
			code: CommonErrorCode.INVALID_AUTHENTICATION_CONTEXT,
			message:
				COMMON_ERROR_MESSAGES[CommonErrorCode.INVALID_AUTHENTICATION_CONTEXT],
		});
	}
}
