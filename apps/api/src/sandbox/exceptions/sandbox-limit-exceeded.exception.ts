/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { PERSISTENT_SANDBOX_NOT_ALLOWED_MESSAGE } from '../constants/resource-limit-messages.constants';
import { SandboxErrorCode } from '../enums/sandbox-error-code.enum';

type SandboxLimitErrorCode =
	| SandboxErrorCode.QUOTA_EXCEEDED
	| SandboxErrorCode.RESOURCE_LIMIT_EXCEEDED
	| SandboxErrorCode.PERSISTENT_NOT_ALLOWED;

export class SandboxLimitExceededException extends BadRequestException {
	constructor(code: SandboxLimitErrorCode, message: string) {
		super({ code, message });
	}

	static quota(message: string): SandboxLimitExceededException {
		return new SandboxLimitExceededException(
			SandboxErrorCode.QUOTA_EXCEEDED,
			message
		);
	}

	static perSandbox(message: string): SandboxLimitExceededException {
		return new SandboxLimitExceededException(
			SandboxErrorCode.RESOURCE_LIMIT_EXCEEDED,
			message
		);
	}

	static persistentNotAllowed(): SandboxLimitExceededException {
		return new SandboxLimitExceededException(
			SandboxErrorCode.PERSISTENT_NOT_ALLOWED,
			PERSISTENT_SANDBOX_NOT_ALLOWED_MESSAGE
		);
	}
}
