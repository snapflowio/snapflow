/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { CreateAdminCommand } from './commands/create-admin.command';
import { EnvironmentDocsCommand } from './commands/env-docs.command';
import { ResetLocalDatabaseCommand } from './commands/reset-database.command';

@Module({
	providers: [
		EnvironmentDocsCommand,
		ResetLocalDatabaseCommand,
		CreateAdminCommand,
	],
})
export class CliModule {}
