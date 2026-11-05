/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import type { Snapshot } from '../entities/snapshot.entity';

export async function persistUniquelyNamed(
	name: string,
	persist: () => Promise<Snapshot>
): Promise<Snapshot> {
	try {
		return await persist();
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new ConflictException(
				`Snapshot with name "${name}" already exists in this organization`
			);
		}
		throw error;
	}
}
