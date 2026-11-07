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
import { AdminMarketPriceController } from './controllers/admin-market-price.controller';
import { HostMachineController } from './controllers/host-machine.controller';
import { MachineListing } from './entities/machine-listing.entity';
import { MachinePriceCard } from './entities/machine-price-card.entity';
import { MarketReferencePrice } from './entities/market-reference-price.entity';
import { SandboxLease } from './entities/sandbox-lease.entity';
import { EgressCeilingService } from './services/egress-ceiling.service';
import { HostMachineService } from './services/host-machine.service';
import { MachineListingService } from './services/machine-listing.service';
import { MachineMarketplaceService } from './services/machine-marketplace.service';
import { PriceCardService } from './services/price-card.service';
import { PriceFloorService } from './services/price-floor.service';
import { PriceHintService } from './services/price-hint.service';
import { SandboxLeaseService } from './services/sandbox-lease.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			MachineListing,
			MachinePriceCard,
			MarketReferencePrice,
			SandboxLease,
		]),
		IdempotencyModule,
		OrganizationModule,
		SettingsModule,
		SettlementModule,
	],
	controllers: [HostMachineController, AdminMarketPriceController],
	providers: [
		MachineMarketplaceService,
		MachineListingService,
		HostMachineService,
		PriceCardService,
		PriceFloorService,
		PriceHintService,
		EgressCeilingService,
		SandboxLeaseService,
	],
	exports: [
		MachineListingService,
		MachineMarketplaceService,
		PriceCardService,
		PriceFloorService,
		SandboxLeaseService,
	],
})
export class MarketplaceModule {}
