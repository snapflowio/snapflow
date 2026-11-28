/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import { Machine } from '../../machine/entities/machine.entity';
import { SETTLEMENT_WAKE_TOPIC } from '../constants/payment-channel.constants';

@Injectable()
export class SettlementWakeService {
	constructor(private readonly wakes: ControlWakeService) {}

	async wakeOrganizationMachines(
		manager: EntityManager,
		organizationId: string
	): Promise<void> {
		const machines = await manager.find(
			Machine,
			{ organizationId },
			{ fields: ['id'] }
		);
		if (machines.length === 0) return;
		this.wakes.notifyAfterCommit(
			manager,
			SETTLEMENT_WAKE_TOPIC,
			machines.map(({ id }) => id)
		);
	}
}
