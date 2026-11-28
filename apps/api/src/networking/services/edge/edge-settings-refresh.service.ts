/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { errorMessage } from '../../../common/utils/error/error.util';
import { SettingsEvents } from '../../../settings/constants/settings.constants';
import { SettingsChangedEvent } from '../../../settings/events/settings-changed.event';
import { ControlSnapshotRefreshService } from '../control-snapshot-refresh.service';

@Injectable()
export class EdgeSettingsRefreshService {
	private readonly logger = new Logger(EdgeSettingsRefreshService.name);

	constructor(
		private readonly snapshotRefresh: ControlSnapshotRefreshService
	) {}

	@OnEvent(SettingsEvents.CHANGED)
	async onSettingsChanged(event: SettingsChangedEvent): Promise<void> {
		if (!event.changed('publicIngressEnabled', 'edgeTrustedHttpProxyCidrs')) {
			return;
		}
		try {
			await this.snapshotRefresh.refreshEdgesGeneratedBefore(
				event.current.updatedAt
			);
		} catch (error) {
			this.logger.error(
				`Could not refresh the edge route snapshots: ${errorMessage(error)}`
			);
		}
	}
}
