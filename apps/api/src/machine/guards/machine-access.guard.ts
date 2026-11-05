/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import {
	ResourceAccessGuard,
	type ResourceRequest,
} from '../../common/guards/resource-access.guard';
import { MachineService } from '../services/machine.service';

@Injectable()
export class MachineAccessGuard extends ResourceAccessGuard {
	constructor(private readonly machineService: MachineService) {
		super();
	}

	protected async organizationIdOf(
		request: ResourceRequest
	): Promise<string | null> {
		const machine = await this.machineService.findOneOrFail(
			request.params.machineId || request.params.id
		);
		return machine.organizationId;
	}

	protected notFoundMessage(): string {
		return 'Machine not found';
	}
}
