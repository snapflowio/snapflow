/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { OrganizationModule } from '../organization/organization.module';
import { AdminOrganizationController } from './controllers/admin-organization.controller';
import { AdminOrganizationService } from './services/admin-organization.service';

@Module({
	imports: [BillingModule, IdempotencyModule, OrganizationModule],
	controllers: [AdminOrganizationController],
	providers: [AdminOrganizationService],
})
export class AdminModule {}
