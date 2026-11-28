/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { UnauthorizedException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { MachineApiErrorCode } from '../enums/machine-api-error-code.enum';

export const MACHINE_SESSION_FENCED_MESSAGE =
	'This machine session was replaced by a newer one. Stop using it and reconnect if this machine should stay online.';

export function machineProofRejected(reason: string): UnauthorizedException {
	return new UnauthorizedException(
		apiError(
			MachineApiErrorCode.PROOF_INVALID,
			`${reason}. Sign a fresh proof with the enrolled machine key and retry; if it keeps failing, reconnect the machine.`
		)
	);
}
