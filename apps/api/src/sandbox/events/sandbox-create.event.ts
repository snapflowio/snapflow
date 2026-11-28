/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../entities/sandbox.entity';
import {
	CAPACITY_HOLD,
	type SandboxHeldResources,
} from '../values/sandbox-hold-policy.value';
import { SandboxEvent } from './sandbox.event';

export class SandboxCreatedEvent extends SandboxEvent {
	readonly held: SandboxHeldResources;

	constructor(sandbox: Sandbox) {
		super(sandbox);
		this.held = CAPACITY_HOLD.held(sandbox);
	}
}
