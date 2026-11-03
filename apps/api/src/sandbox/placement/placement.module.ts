/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { BillingLedgerModule } from '../../billing/ledger/ledger.module';
import { LocationModule } from '../../location/location.module';
import { MarketplaceMachineModule } from '../../marketplace/machine/machine.module';
import { SettingsPlatformModule } from '../../settings/platform/platform.module';
import { MachineModule } from '../machine/machine.module';
import { MachineAvailabilityService } from './services/machine-availability.service';
import { MachineCapacityService } from './services/machine-capacity.service';
import { MachineReservationService } from './services/machine-reservation.service';
import { MachineSchedulingService } from './services/machine-scheduling.service';
import { PlacementQuoteService } from './services/placement-quote.service';
import { SandboxPlacementService } from './services/sandbox-placement.service';
import { SandboxPlacementControlService } from './services/sandbox-placement-control.service';
import { SandboxPlacementResolverService } from './services/sandbox-placement-resolver.service';

@Module({
	imports: [
		BillingLedgerModule,
		MarketplaceMachineModule,
		LocationModule,
		MachineModule,
		SettingsPlatformModule,
	],
	providers: [
		MachineAvailabilityService,
		PlacementQuoteService,
		MachineCapacityService,
		MachineReservationService,
		MachineSchedulingService,
		SandboxPlacementControlService,
		SandboxPlacementResolverService,
		SandboxPlacementService,
	],
	exports: [
		MachineAvailabilityService,
		PlacementQuoteService,
		MachineCapacityService,
		MachineReservationService,
		MachineSchedulingService,
		SandboxPlacementControlService,
		SandboxPlacementResolverService,
		SandboxPlacementService,
	],
})
export class PlacementModule {}
