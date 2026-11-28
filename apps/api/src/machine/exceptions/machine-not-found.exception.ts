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
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';

const MACHINE_NOT_FOUND_NEXT_STEP =
	'Check the machine ID; the machine may have been removed.';

export class MachineNotFoundException extends NotFoundException {
	constructor(machineId?: string) {
		super(
			apiError(
				MarketplaceErrorCode.MACHINE_NOT_FOUND,
				machineId === undefined
					? `The machine was not found. ${MACHINE_NOT_FOUND_NEXT_STEP}`
					: `Machine ${machineId} was not found. ${MACHINE_NOT_FOUND_NEXT_STEP}`
			)
		);
	}
}
