/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { NestFactory } from '@nestjs/core';
import { Command, CommandRunner, Option } from 'nest-commander';
import { DEVELOPMENT_ADMINISTRATOR } from '../../app/scheduler/constants/development-seed.constants';
import {
	AdministratorBootstrapService,
	type FirstAdministrator,
} from '../../auth/services/administrator-bootstrap.service';
import { readEnvironment } from '../../config/environment/utils/read-environment.util';
import { writeLine } from '../cli-output.util';

const CLI_LOG_LEVELS = ['warn', 'error'] as const;

type CreateAdminOptions = Readonly<{ email?: string; name?: string }>;

@Command({
	name: 'create-admin',
	description:
		'Create the first administrator, who signs in with an emailed one-time code',
})
export class CreateAdminCommand extends CommandRunner {
	@Option({ flags: '--email <email>', description: 'Administrator email' })
	parseEmail(value: string): string {
		return value.trim().toLowerCase();
	}

	@Option({ flags: '--name <name>', description: 'Administrator name' })
	parseName(value: string): string {
		return value.trim();
	}

	public async run(): Promise<void> {
		const administrator = this.administrator(
			this.command.opts<CreateAdminOptions>()
		);
		const { CliAppModule } = await import('../../app/root/app.module');
		const app = await NestFactory.createApplicationContext(CliAppModule, {
			logger: [...CLI_LOG_LEVELS],
		});
		try {
			const administrators = app.get(AdministratorBootstrapService);
			const created = await RequestContext.create(app.get(MikroORM).em, () =>
				administrators.createFirst(administrator)
			);
			if (!created) {
				throw new Error(
					'An administrator already exists; manage administrators in the dashboard'
				);
			}
		} finally {
			await app.close();
		}
		writeLine(
			`Created administrator ${administrator.email}; sign in with an emailed code, then add a passkey or an authenticator app before using admin pages`
		);
	}

	private administrator(options: CreateAdminOptions): FirstAdministrator {
		const { profile } = readEnvironment(process.env, []);
		const development = !options.email && !profile.hosted;
		const name = development ? DEVELOPMENT_ADMINISTRATOR.name : options.name;
		const email = development ? DEVELOPMENT_ADMINISTRATOR.email : options.email;
		if (!email || !name) {
			throw new Error('--email and --name are required');
		}
		return { name, email };
	}
}
