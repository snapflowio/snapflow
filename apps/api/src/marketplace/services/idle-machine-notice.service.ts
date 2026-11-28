/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../common/utils/error/error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineState } from '../../machine/enums/machine-state.enum';
import {
	HostNoticeKind,
	NOTICE_COOLDOWN_SECONDS,
} from '../../notification/constants/notice.constants';
import { HostNoticeEvent } from '../../notification/events/host-notice.event';
import {
	cooldownNoticeKey,
	enqueueHostNotice,
} from '../../notification/utils/notice-outbox.util';
import { IDLE_MACHINE_NOTICE } from '../constants/marketplace.constants';
import { PRIMARY_RATE } from '../constants/pricing.constants';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import {
	machineUtilization,
	utilizationOf,
} from '../queries/machine-utilization.query';
import { MachineMarketService } from './machine-market.service';

const IDLE_CANDIDATES_SQL = `SELECT machine.id FROM machine
	JOIN machine_listing listing ON listing."machineId" = machine.id
	WHERE listing.state = ? AND listing.visibility = ? AND machine.state = ?
	  AND machine."listedSince" < now() - (? * interval '1 day')
	ORDER BY machine.id LIMIT ?`;

@Injectable()
export class IdleMachineNoticeService {
	private readonly logger = new Logger(IdleMachineNoticeService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineMarket: MachineMarketService
	) {}

	async scan(): Promise<void> {
		const manager = this.entityManager.fork();
		const candidates = await manager.execute<{ id: string }[]>(
			IDLE_CANDIDATES_SQL,
			[
				ListingState.LISTED,
				ListingVisibility.PUBLIC,
				MachineState.READY,
				IDLE_MACHINE_NOTICE.MINIMUM_LISTED_DAYS,
				IDLE_MACHINE_NOTICE.BATCH_SIZE,
			]
		);
		const ids = candidates.map(({ id }) => id);
		const utilization = await machineUtilization(manager, ids);
		const idle = ids.filter((id) => {
			const lastWeek = utilizationOf(utilization, id).lastWeekBasisPoints;
			return (
				lastWeek !== null &&
				lastWeek < IDLE_MACHINE_NOTICE.IDLE_BELOW_BASIS_POINTS
			);
		});
		if (idle.length === 0) return;
		const now = await databaseNow(manager);
		const machines = await manager.find(Machine, { id: { $in: idle } });
		const listings = await manager.find(MachineListing, {
			machineId: { $in: idle },
		});
		const cards = await manager.find(MachinePriceCard, {
			id: {
				$in: listings.flatMap(({ currentPriceCardId }) =>
					currentPriceCardId ? [currentPriceCardId] : []
				),
			},
		});
		for (const machine of machines) {
			const cardId = listings.find(
				({ machineId }) => machineId === machine.id
			)?.currentPriceCardId;
			const card = cards.find(({ id }) => id === cardId);
			if (!card) continue;
			try {
				const market = await this.machineMarket.market(manager, machine);
				const rate =
					machine.category === MachineCategory.GPU
						? PRIMARY_RATE.GPU
						: PRIMARY_RATE.CPU;
				await enqueueHostNotice(
					manager,
					new HostNoticeEvent(
						machine.organizationId,
						cooldownNoticeKey(
							now,
							NOTICE_COOLDOWN_SECONDS.machineIdle,
							IDLE_MACHINE_NOTICE.KEY,
							machine.id
						),
						{
							kind: HostNoticeKind.MACHINE_IDLE,
							machineId: machine.id,
							machineName: machine.name,
							utilizationBasisPoints:
								utilizationOf(utilization, machine.id).lastWeekBasisPoints ?? 0,
							rateUnit: rate.unit,
							currentRateMicroUsd: card[rate.field],
							marketMedianRateMicroUsd:
								market.rates[rate.field]?.median ?? null,
						},
						now
					)
				);
			} catch (error) {
				this.logger.warn(
					`Skipped the idle notice for machine ${machine.id}: ${errorMessage(error)}`
				);
			}
		}
	}
}
