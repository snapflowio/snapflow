/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { BillingModule } from '../../billing/billing.module';
import { IdempotencyModule } from '../../idempotency/idempotency.module';
import { LocationModule } from '../../location/location.module';
import { SettingsModule } from '../../settings/settings.module';
import { MarketplaceModule } from '../marketplace.module';
import { ListingController } from './controllers/listing.controller';
import { LocationController } from './controllers/location.controller';
import { MachineBrowseService } from './services/machine-browse.service';
import { MachineLocationDirectoryService } from './services/machine-location-directory.service';

@Module({
	imports: [
		BillingModule,
		IdempotencyModule,
		LocationModule,
		MarketplaceModule,
		SettingsModule,
	],
	controllers: [ListingController, LocationController],
	providers: [MachineBrowseService, MachineLocationDirectoryService],
})
export class MarketplaceBrowseModule {}
