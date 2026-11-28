/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { NotFoundException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { SandboxErrorCode } from '../enums/sandbox-error-code.enum';

const SANDBOX_NOT_FOUND_NEXT_STEP =
	'Check the sandbox ID or name; the sandbox may have been deleted.';

export class SandboxNotFoundException extends NotFoundException {
	constructor(idOrName?: string) {
		super(
			apiError(
				SandboxErrorCode.NOT_FOUND,
				idOrName === undefined
					? `The sandbox was not found. ${SANDBOX_NOT_FOUND_NEXT_STEP}`
					: `Sandbox ${idOrName} was not found. ${SANDBOX_NOT_FOUND_NEXT_STEP}`
			)
		);
	}
}
