/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MachineSession } from '../entities/machine-session.entity';
import {
	MACHINE_SESSION_REQUEST_PROPERTY,
	type MachineSessionRequest,
} from '../guards/machine-session.guard';

export const ActiveMachineSession = createParamDecorator(
	(_data: unknown, context: ExecutionContext): MachineSession => {
		const request = context.switchToHttp().getRequest<MachineSessionRequest>();
		const session = request[MACHINE_SESSION_REQUEST_PROPERTY];
		if (!session) throw new Error('Machine session guard was not applied');
		return session;
	}
);
