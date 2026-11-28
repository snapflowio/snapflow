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
import { VolumeErrorCode } from '../enums/volume-error-code.enum';

const VOLUME_NOT_FOUND_NEXT_STEP =
	'Check the volume ID or name; the volume may have been deleted.';

export class VolumeNotFoundException extends NotFoundException {
	constructor(idOrName?: string) {
		super(
			apiError(
				VolumeErrorCode.NOT_FOUND,
				idOrName === undefined
					? `The volume was not found. ${VOLUME_NOT_FOUND_NEXT_STEP}`
					: `Volume ${idOrName} was not found. ${VOLUME_NOT_FOUND_NEXT_STEP}`
			)
		);
	}
}
