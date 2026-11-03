/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { MarketplaceMachineModule } from '../../marketplace/machine/machine.module';
import { OrganizationTenantModule } from '../../organization/tenant/tenant.module';
import { PaymentsFundsModule } from '../../payments/funds/funds.module';
import { MachineModule } from '../../sandbox/machine/machine.module';
import { UserModule } from '../../user/user.module';
import { VerificationQualificationModule } from '../../verification/qualification/qualification.module';
import { DevelopmentMachineController } from './controllers/development-machine.controller';
import { DevelopmentMachineEnrollmentGuard } from './guards/development-machine-enrollment.guard';
import { DevelopmentMachineEnrollmentService } from './services/development-machine-enrollment.service';
import { DevelopmentMachineSeedService } from './services/development-machine-seed.service';

@Module({
	imports: [
		MachineModule,
		MarketplaceMachineModule,
		OrganizationTenantModule,
		PaymentsFundsModule,
		UserModule,
		VerificationQualificationModule,
	],
	controllers: [DevelopmentMachineController],
	providers: [
		DevelopmentMachineEnrollmentGuard,
		DevelopmentMachineEnrollmentService,
		DevelopmentMachineSeedService,
	],
})
export class AppDevelopmentModule {}
