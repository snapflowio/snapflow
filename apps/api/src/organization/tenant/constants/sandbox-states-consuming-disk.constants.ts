/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxState } from '../../../sandbox/instance/enums/sandbox-state.enum';
import { SANDBOX_STATES_CONSUMING_COMPUTE } from './sandbox-states-consuming-compute.constants';

export const SANDBOX_STATES_CONSUMING_DISK: SandboxState[] = [
	...SANDBOX_STATES_CONSUMING_COMPUTE,
	SandboxState.STOPPED,
	SandboxState.PAUSED,
	SandboxState.ARCHIVING,
	SandboxState.RESIZING,
	SandboxState.SNAPSHOTTING,
];
