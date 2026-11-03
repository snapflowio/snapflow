/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import { SANDBOX_STATE_WAKE_TOPIC } from '../constants/sandbox-state-wait.constants';
import type { SandboxEvent } from '../events/sandbox.event';

@Injectable()
export class SandboxStateWakeListener {
	constructor(private readonly wakes: ControlWakeService) {}

	@OnEvent(SandboxEvents.STATE_UPDATED)
	wakeOnStateChange(event: SandboxEvent): void {
		this.wake(event);
	}

	@OnEvent(SandboxEvents.DESIRED_STATE_UPDATED)
	wakeOnDesiredStateChange(event: SandboxEvent): void {
		this.wake(event);
	}

	private wake({ sandbox }: SandboxEvent): void {
		this.wakes.notify(SANDBOX_STATE_WAKE_TOPIC, [sandbox.id]);
	}
}
