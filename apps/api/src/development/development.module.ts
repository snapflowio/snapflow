/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DockerRegistryModule } from '../docker-registry/docker-registry.module';
import { MachineModule } from '../machine/machine.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { NetworkingModule } from '../networking/networking.module';
import { OrganizationModule } from '../organization/organization.module';
import { SettingsModule } from '../settings/settings.module';
import { SettlementModule } from '../settlement/settlement.module';
import { UserModule } from '../user/user.module';
import { VerificationModule } from '../verification/verification.module';
import { DevelopmentMachineController } from './controllers/development-machine.controller';
import { DevelopmentMachineEnrollmentGuard } from './guards/development-machine-enrollment.guard';
import { DevelopmentMachineEnrollmentService } from './services/development-machine-enrollment.service';
import { DevelopmentMachineSeedService } from './services/development-machine-seed.service';
import { DevelopmentSeedService } from './services/development-seed.service';

@Module({
	imports: [
		AuthModule,
		DockerRegistryModule,
		MachineModule,
		MarketplaceModule,
		NetworkingModule,
		OrganizationModule,
		SettingsModule,
		SettlementModule,
		UserModule,
		VerificationModule,
	],
	controllers: [DevelopmentMachineController],
	providers: [
		DevelopmentMachineEnrollmentGuard,
		DevelopmentMachineEnrollmentService,
		DevelopmentMachineSeedService,
		DevelopmentSeedService,
	],
	exports: [DevelopmentSeedService],
})
export class AppDevelopmentModule {}
