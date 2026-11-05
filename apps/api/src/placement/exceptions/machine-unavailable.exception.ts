/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import type { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import type { SandboxPlacementAlternativeDto } from '../../sandbox/dto/sandbox-quote.dto';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';

export class MachineUnavailableException extends ConflictException {
	constructor(
		machineId: string,
		readonly reason: MachineUnavailableReason,
		alternatives: readonly SandboxPlacementAlternativeDto[]
	) {
		super({
			code: SandboxPlacementErrorCode.MACHINE_UNAVAILABLE,
			message: 'The pinned machine cannot take this sandbox now',
			machineId,
			reason,
			alternatives,
		});
	}
}
