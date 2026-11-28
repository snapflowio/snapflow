/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../entities/sandbox.entity';
import type { SandboxHeldResources } from '../values/sandbox-hold-policy.value';
import { SandboxEvent } from './sandbox.event';

export class SandboxResourceHoldUpdatedEvent extends SandboxEvent {
	constructor(
		sandbox: Sandbox,
		readonly previous: SandboxHeldResources,
		readonly current: SandboxHeldResources
	) {
		super(sandbox);
	}
}
