/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import type { MachineSession } from '../entities/machine-session.entity';
import { MachineSessionService } from '../services/machine-session.service';

export const MACHINE_SESSION_REQUEST_PROPERTY = 'machineSession' as const;

export type MachineSessionRequest = Request & {
	[MACHINE_SESSION_REQUEST_PROPERTY]?: MachineSession;
	user?: MachineAuthContext;
};

@Injectable()
export class MachineSessionGuard {
	constructor(private readonly machineSessionService: MachineSessionService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<MachineSessionRequest>();
		const authenticated =
			await this.machineSessionService.authenticate(request);
		request[MACHINE_SESSION_REQUEST_PROPERTY] = authenticated.session;
		request.user = {
			role: 'machine',
			machineId: authenticated.machine.id,
			machine: authenticated.machine,
		};
		return true;
	}
}
