/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import { SnapshotErrorCode } from '../enums/snapshot-error-code.enum';

export async function persistUniquelyNamed<T>(
	name: string,
	persist: () => Promise<T>
): Promise<T> {
	try {
		return await persist();
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new ConflictException(
				apiError(
					SnapshotErrorCode.NAME_TAKEN,
					`A snapshot named ${name} already exists in this organization. Choose another name.`
				)
			);
		}
		throw error;
	}
}
