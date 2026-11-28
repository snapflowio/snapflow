/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import { CommonErrorCode } from '../../common/enums/common-error-code.enum';

const SNAPSHOT_MODIFIED_MESSAGE =
	'The snapshot was changed by another request. Reload it and try again.';

export class SnapshotConflictException extends ConflictException {
	constructor() {
		super({
			code: CommonErrorCode.RESOURCE_MODIFIED,
			message: SNAPSHOT_MODIFIED_MESSAGE,
		});
	}
}
