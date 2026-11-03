/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { errorMessage } from '../../../common/utils/error/error.util';
import { SnapshotEvents } from '../constants/snapshot-events.constants';

export class SnapshotBuildSettledEvent {
	constructor(
		public readonly machineId: string,
		public readonly snapshotRefs: readonly string[]
	) {}
}

export function publishSnapshotBuildSettled(
	eventEmitter: EventEmitter2,
	logger: Logger,
	event: SnapshotBuildSettledEvent
): void {
	eventEmitter
		.emitAsync(SnapshotEvents.BUILD_SETTLED, event)
		.catch((error: unknown) =>
			logger.error(
				`Failed to wake the builds waiting on machine ${event.machineId}: ${errorMessage(error)}`
			)
		);
}
