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
import { AdminUserController } from './controllers/admin-user.controller';
import { UserController } from './controllers/user.controller';
import { User } from './entities/user.entity';
import { AdminUserService } from './services/admin-user.service';
import { UserService } from './services/user.service';

@Module({
	imports: [MikroOrmModule.forFeature([User])],
	controllers: [UserController, AdminUserController],
	providers: [UserService, AdminUserService],
	exports: [UserService],
})
export class UserModule {}
