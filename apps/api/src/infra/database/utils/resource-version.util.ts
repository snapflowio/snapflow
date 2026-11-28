/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { CommonErrorCode } from '../../../common/enums/common-error-code.enum';
import { commonApiError } from '../../../common/utils/error/api-error.util';

const ENTITY_TAG_PATTERN = /^(?:W\/)?"?(\d+)"?$/;

export function parseRequiredResourceVersion(
	ifMatch: string | undefined
): number {
	const match = ifMatch?.trim().match(ENTITY_TAG_PATTERN);
	if (!match) {
		throw new BadRequestException(
			commonApiError(CommonErrorCode.RESOURCE_VERSION_REQUIRED)
		);
	}
	const version = Number(match[1]);
	if (!Number.isSafeInteger(version) || version < 1) {
		throw new BadRequestException(
			commonApiError(CommonErrorCode.RESOURCE_VERSION_INVALID)
		);
	}
	return version;
}
