/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { OrganizationModule } from '../organization/organization.module';
import { SettingsModule } from '../settings/settings.module';
import { SettlementModule } from '../settlement/settlement.module';
import { HostDemandController } from './controllers/host-demand.controller';
import { HostMachineController } from './controllers/host-machine.controller';
import { HostProfileController } from './controllers/host-profile.controller';
import { HostProfile } from './entities/host-profile.entity';
import { MachineListing } from './entities/machine-listing.entity';
import { MachinePriceCard } from './entities/machine-price-card.entity';
import { PlacementPrice } from './entities/placement-price.entity';
import { UnmetDemand } from './entities/unmet-demand.entity';
import { HostMachineService } from './services/host-machine.service';
import { HostProfileService } from './services/host-profile.service';
import { MachineListingService } from './services/machine-listing.service';
import { MachineMarketService } from './services/machine-market.service';
import { MachineMarketplaceService } from './services/machine-marketplace.service';
import { PlacementPriceService } from './services/placement-price.service';
import { PriceCardService } from './services/price-card.service';
import { UnmetDemandService } from './services/unmet-demand.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			HostProfile,
			MachineListing,
			MachinePriceCard,
			PlacementPrice,
			UnmetDemand,
		]),
		IdempotencyModule,
		OrganizationModule,
		SettingsModule,
		SettlementModule,
	],
	controllers: [
		HostDemandController,
		HostMachineController,
		HostProfileController,
	],
	providers: [
		UnmetDemandService,
		MachineMarketplaceService,
		MachineListingService,
		HostMachineService,
		HostProfileService,
		PriceCardService,
		MachineMarketService,
		PlacementPriceService,
	],
	exports: [
		UnmetDemandService,
		HostProfileService,
		MachineListingService,
		MachineMarketplaceService,
		PriceCardService,
		MachineMarketService,
		PlacementPriceService,
	],
})
export class MarketplaceModule {}
