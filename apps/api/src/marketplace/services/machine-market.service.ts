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
import type { Machine } from '../../machine/entities/machine.entity';
import { SettingsService } from '../../settings/services/settings.service';
import { MachineMarketDto } from '../dto/machine-market.dto';
import { priceClassFillRates } from '../queries/price-class-fill.query';
import { priceClassRatePercentiles } from '../queries/price-class-market.query';
import { marketMarkupBasisPoints } from '../utils/pricing/markup.util';
import { requirePriceClass } from '../utils/pricing/price-class.util';

@Injectable()
export class MachineMarketService {
	constructor(private readonly settings: SettingsService) {}

	async market(
		manager: EntityManager,
		machine: Pick<Machine, 'id' | 'category' | 'gpuType'>
	): Promise<MachineMarketDto> {
		const { priceClass } = requirePriceClass(machine);
		const [percentiles, fill, settings] = await Promise.all([
			priceClassRatePercentiles(manager, priceClass, machine.id),
			priceClassFillRates(manager),
			this.settings.get(),
		]);
		return {
			priceClass,
			comparableListings: percentiles?.listings ?? 0,
			fillBasisPoints: fill.get(priceClass)?.fillBasisPoints ?? 0,
			markupBasisPoints: marketMarkupBasisPoints(settings),
			rates: MachineMarketDto.ratesFrom(percentiles),
		};
	}
}
