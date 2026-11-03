/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import {
	HOURS_PER_DAY,
	MINUTES_PER_HOUR,
} from '../../../../common/constants/time.constants';
import type { Settings } from '../../../../settings/platform/entities/settings.entity';
import { RETENTION_ARCHIVE_INTERVAL_MINUTES } from '../../constants/sandbox.constants';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import {
	autoDeleteIntervalMatchesMode,
	resolveAutoDeleteInterval,
} from './ephemeral.util';

export function resolveAutoStopInterval(autoStopInterval: number): number {
	if (autoStopInterval < 0) {
		throw new BadRequestException('Auto-stop interval must be non-negative');
	}

	return autoStopInterval;
}

export function retentionArchiveMinutes(
	settings: Pick<Settings, 'stoppedSandboxRetentionDays'>
): number {
	return (
		settings.stoppedSandboxRetentionDays * HOURS_PER_DAY * MINUTES_PER_HOUR
	);
}

export function resolveAutoArchiveInterval(
	autoArchiveInterval: number,
	maxAutoArchiveInterval: number
): number {
	if (autoArchiveInterval < 0) {
		throw new BadRequestException('Auto-archive interval must be non-negative');
	}

	if (autoArchiveInterval === RETENTION_ARCHIVE_INTERVAL_MINUTES) {
		return RETENTION_ARCHIVE_INTERVAL_MINUTES;
	}

	return Math.min(autoArchiveInterval, maxAutoArchiveInterval);
}

export function resolveModeAutoDeleteInterval(
	mode: SandboxMode,
	requestedInterval?: number
): number {
	if (!autoDeleteIntervalMatchesMode(mode, requestedInterval)) {
		throw new BadRequestException(
			mode === SandboxMode.EPHEMERAL
				? 'Ephemeral sandboxes must delete immediately when stopped; omit autoDeleteInterval or set it to 0'
				: 'Standard sandboxes cannot delete immediately when stopped; select ephemeral mode or use a non-zero autoDeleteInterval'
		);
	}

	return resolveAutoDeleteInterval(mode, requestedInterval);
}
