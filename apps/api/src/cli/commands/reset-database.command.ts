/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Command, CommandRunner } from 'nest-commander';
import { Client } from 'pg';
import { databaseEnvironment } from '../../config/environment/namespaces/database.environment';
import { readEnvironment } from '../../config/environment/utils/read-environment.util';
import { writeLine } from '../cli-output.util';

const LOCAL_DATABASE_HOSTS: ReadonlySet<string> = new Set([
	'postgres',
	'localhost',
	'127.0.0.1',
	'host.docker.internal',
]);
const RESET_STATEMENTS = [
	'DROP SCHEMA IF EXISTS public CASCADE',
	'CREATE SCHEMA public AUTHORIZATION CURRENT_USER',
	'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
	'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
] as const;

@Command({
	name: 'reset-local-database',
	description: 'Drop and recreate the development database schema',
})
export class ResetLocalDatabaseCommand extends CommandRunner {
	public async run(): Promise<void> {
		const { profile, values } = readEnvironment(process.env, [
			databaseEnvironment,
		]);
		if (profile.hosted) {
			throw new Error(`Refusing to reset the ${profile.name} database`);
		}
		const url = new URL(values.DATABASE_URL);
		if (!LOCAL_DATABASE_HOSTS.has(url.hostname)) {
			throw new Error(`Refusing to reset a database on ${url.hostname}`);
		}
		const client = new Client({ connectionString: values.DATABASE_URL });
		await client.connect();
		try {
			for (const statement of RESET_STATEMENTS) await client.query(statement);
		} finally {
			await client.end();
		}
		writeLine(`Reset database ${url.pathname.slice(1)} on ${url.hostname}`);
	}
}
