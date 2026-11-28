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
import { AuditModule } from '../audit/audit.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../user/entities/user.entity';
import { OrganizationQuotaTierController } from './controllers/organization-quota-tier.controller';
import { OrganizationSettingsController } from './controllers/organization-settings.controller';
import { OrganizationUsageController } from './controllers/organization-usage.controller';
import { Invitation } from './entities/invitation.entity';
import { Member } from './entities/member.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationLimits } from './entities/organization-limits.entity';
import { OrganizationQuota } from './entities/organization-quota.entity';
import { OrganizationQuotaIncreaseRequest } from './entities/organization-quota-increase-request.entity';
import { OrganizationRole } from './entities/organization-role.entity';
import { OrganizationService } from './services/organization.service';
import { OrganizationLimitsService } from './services/organization-limits.service';
import { OrganizationOwnershipService } from './services/organization-ownership.service';
import { OrganizationQuotaService } from './services/organization-quota.service';
import { OrganizationQuotaIncreaseRequestService } from './services/organization-quota-increase-request.service';
import { OrganizationQuotaTierService } from './services/organization-quota-tier.service';
import { OrganizationSettingsService } from './services/organization-settings.service';
import { OrganizationStorageCapService } from './services/organization-storage-cap.service';
import { OrganizationSuspensionService } from './services/organization-suspension.service';
import { PersonalOrganizationService } from './services/personal-organization.service';
import { OrganizationUsageService } from './services/usage/organization-usage.service';
import { OrganizationUsageCacheService } from './services/usage/organization-usage-cache.service';
import { OrganizationUsageEventsService } from './services/usage/organization-usage-events.service';
import { OrganizationUsageOverviewService } from './services/usage/organization-usage-overview.service';
import { OrganizationUsageRecountService } from './services/usage/organization-usage-recount.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			Invitation,
			Member,
			Organization,
			OrganizationLimits,
			OrganizationQuota,
			OrganizationQuotaIncreaseRequest,
			OrganizationRole,
			User,
		]),
		AuditModule,
		RedisConnectionModule,
		SettingsModule,
	],
	controllers: [
		OrganizationQuotaTierController,
		OrganizationSettingsController,
		OrganizationUsageController,
	],
	providers: [
		OrganizationLimitsService,
		OrganizationOwnershipService,
		OrganizationQuotaService,
		OrganizationQuotaIncreaseRequestService,
		OrganizationQuotaTierService,
		OrganizationService,
		OrganizationSettingsService,
		OrganizationStorageCapService,
		OrganizationSuspensionService,
		OrganizationUsageCacheService,
		OrganizationUsageEventsService,
		OrganizationUsageOverviewService,
		OrganizationUsageRecountService,
		OrganizationUsageService,
		PersonalOrganizationService,
	],
	exports: [
		OrganizationLimitsService,
		OrganizationOwnershipService,
		OrganizationQuotaService,
		OrganizationQuotaIncreaseRequestService,
		OrganizationQuotaTierService,
		OrganizationService,
		OrganizationStorageCapService,
		OrganizationSuspensionService,
		OrganizationUsageOverviewService,
		OrganizationUsageService,
		PersonalOrganizationService,
	],
})
export class OrganizationModule {}
