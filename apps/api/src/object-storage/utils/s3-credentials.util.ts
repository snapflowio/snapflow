/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { OBJECT_STORAGE_UNAVAILABLE_MESSAGE } from '../constants/object-storage-error.constants';
import { ObjectStorageErrorCode } from '../enums/object-storage-error-code.enum';

export function staticCredentials(
	accessKeyId: string | undefined,
	secretAccessKey: string | undefined
) {
	if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
		throw new ServiceUnavailableException(
			apiError(
				ObjectStorageErrorCode.UNAVAILABLE,
				OBJECT_STORAGE_UNAVAILABLE_MESSAGE
			)
		);
	}
	return accessKeyId && secretAccessKey
		? { accessKeyId, secretAccessKey }
		: undefined;
}
