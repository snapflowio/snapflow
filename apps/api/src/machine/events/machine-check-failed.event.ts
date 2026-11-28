/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineCheck } from '../constants/machine-check.constants';

export class MachineCheckFailedEvent {
	constructor(
		readonly organizationId: string,
		readonly machineId: string,
		readonly check: MachineCheck,
		readonly failures: readonly string[],
		readonly observedAt: Date
	) {}
}
