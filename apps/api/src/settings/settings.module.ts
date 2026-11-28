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
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { Settings } from './entities/settings.entity';
import { SettingsService } from './services/settings.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([Settings]),
		AuditModule,
		ControlWakeModule,
	],
	controllers: [AdminSettingsController],
	providers: [SettingsService],
	exports: [SettingsService],
})
export class SettingsModule {}
