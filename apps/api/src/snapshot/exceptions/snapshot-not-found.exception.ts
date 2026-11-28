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
import { SnapshotErrorCode } from '../enums/snapshot-error-code.enum';

const SNAPSHOT_NOT_FOUND_NEXT_STEP =
	'Check the snapshot ID or name; the snapshot may have been deleted.';

export class SnapshotNotFoundException extends NotFoundException {
	constructor(idOrName?: string) {
		super(
			apiError(
				SnapshotErrorCode.NOT_FOUND,
				idOrName === undefined
					? `The snapshot was not found. ${SNAPSHOT_NOT_FOUND_NEXT_STEP}`
					: `Snapshot ${idOrName} was not found. ${SNAPSHOT_NOT_FOUND_NEXT_STEP}`
			)
		);
	}
}
