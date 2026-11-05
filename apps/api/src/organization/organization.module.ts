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
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../user/entities/user.entity';
import { OrganizationSettingsController } from './controllers/organization-settings.controller';
import { OrganizationUsageController } from './controllers/organization-usage.controller';
import { Invitation } from './entities/invitation.entity';
import { Member } from './entities/member.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationLimits } from './entities/organization-limits.entity';
import { OrganizationQuota } from './entities/organization-quota.entity';
import { OrganizationRole } from './entities/organization-role.entity';
import { OrganizationService } from './services/organization.service';
import { OrganizationLimitsService } from './services/organization-limits.service';
import { OrganizationOwnershipService } from './services/organization-ownership.service';
import { OrganizationQuotaService } from './services/organization-quota.service';
import { OrganizationSettingsService } from './services/organization-settings.service';
import { OrganizationSuspensionService } from './services/organization-suspension.service';
import { OrganizationUsageService } from './services/organization-usage.service';
import { OrganizationUsageCacheService } from './services/organization-usage-cache.service';
import { OrganizationUsageEventsService } from './services/organization-usage-events.service';
import { OrganizationUsageOverviewService } from './services/organization-usage-overview.service';
import { OrganizationUsageRecountService } from './services/organization-usage-recount.service';
import { PersonalOrganizationService } from './services/personal-organization.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			Invitation,
			Member,
			Organization,
			OrganizationLimits,
			OrganizationQuota,
			OrganizationRole,
			User,
		]),
		RedisConnectionModule,
		SettingsModule,
	],
	controllers: [OrganizationSettingsController, OrganizationUsageController],
	providers: [
		OrganizationLimitsService,
		OrganizationOwnershipService,
		OrganizationQuotaService,
		OrganizationService,
		OrganizationSettingsService,
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
		OrganizationService,
		OrganizationSuspensionService,
		OrganizationUsageOverviewService,
		OrganizationUsageService,
		PersonalOrganizationService,
	],
})
export class OrganizationModule {}
