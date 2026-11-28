/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { apiError } from '../../../common/utils/error/api-error.util';
import {
	MAXIMUM_ARCHIVE_INTERVAL_MINUTES,
	ORGANIZATION_ARCHIVE_INTERVAL_MINUTES,
} from '../../constants/sandbox.constants';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import {
	autoDeleteIntervalMatchesMode,
	resolveAutoDeleteInterval,
} from './ephemeral.util';

export function resolveAutoStopInterval(autoStopInterval: number): number {
	if (autoStopInterval < 0) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.INTERVAL_INVALID,
				'The auto-stop interval cannot be negative. Use 0 to disable auto-stop or a positive number of minutes.'
			)
		);
	}

	return autoStopInterval;
}

export function resolveAutoArchiveInterval(
	autoArchiveInterval: number
): number {
	if (
		!Number.isInteger(autoArchiveInterval) ||
		autoArchiveInterval < ORGANIZATION_ARCHIVE_INTERVAL_MINUTES ||
		autoArchiveInterval > MAXIMUM_ARCHIVE_INTERVAL_MINUTES
	) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.INTERVAL_INVALID,
				`The auto-archive interval must be a whole number of minutes from ${ORGANIZATION_ARCHIVE_INTERVAL_MINUTES} to ${MAXIMUM_ARCHIVE_INTERVAL_MINUTES}. Choose a value in that range.`
			)
		);
	}
	return autoArchiveInterval;
}

export function resolveModeAutoDeleteInterval(
	mode: SandboxMode,
	requestedInterval?: number
): number {
	if (!autoDeleteIntervalMatchesMode(mode, requestedInterval)) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.INTERVAL_INVALID,
				mode === SandboxMode.EPHEMERAL
					? 'Ephemeral sandboxes are deleted as soon as they stop. Omit autoDeleteInterval or set it to 0.'
					: 'Standard sandboxes cannot be deleted as soon as they stop. Choose ephemeral mode or set a non-zero autoDeleteInterval.'
			)
		);
	}

	return resolveAutoDeleteInterval(mode, requestedInterval);
}
