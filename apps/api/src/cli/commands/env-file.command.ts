/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { Command, CommandRunner } from 'nest-commander';
import { layoutEnvironmentFile } from '../../config/environment/utils/environment-file.util';
import { writeLine } from '../cli-output.util';
import { localSettlementEnvironment } from '../local-settlement-environment.util';

const LOCAL_ENVIRONMENT_FILE = 'apps/api/.env';
const PRIVATE_FILE_MODE = 0o600;

@Command({
	name: 'env-file',
	description:
		'Lay out apps/api/.env with every variable development may set, in schema order, pointing unset settlement variables at the dev chain',
})
export class EnvironmentFileCommand extends CommandRunner {
	public async run(): Promise<void> {
		const path = LOCAL_ENVIRONMENT_FILE;
		const current = existsSync(path) ? await readFile(path, 'utf8') : '';
		const { content, added, unregistered } = layoutEnvironmentFile(
			current,
			await localSettlementEnvironment()
		);
		if (unregistered.length > 0) {
			throw new Error(
				`${path} sets unregistered variables: ${unregistered.join(', ')}`
			);
		}
		if (content === current) {
			writeLine(`Up to date: ${path}`);
			return;
		}
		await writeFile(path, content, { mode: PRIVATE_FILE_MODE });
		writeLine(
			added.length > 0
				? `Wrote ${path}; listed ${added.join(', ')}`
				: `Wrote ${path}`
		);
	}
}
