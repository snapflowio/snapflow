/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli/cli.module';
import { errorMessage } from './common/utils/error/error.util';

const FAILURE_EXIT_CODE = 1;
const SUCCESS_EXIT_CODE = 0;

function fail(error: unknown): never {
	const exitCode =
		error instanceof Error &&
		'exitCode' in error &&
		typeof error.exitCode === 'number'
			? error.exitCode
			: FAILURE_EXIT_CODE;
	if (exitCode !== SUCCESS_EXIT_CODE) {
		process.stderr.write(`${errorMessage(error)}\n`);
	}

	process.exit(exitCode);
}

try {
	await CommandFactory.run(CliModule, {
		logger: ['warn', 'error'],
		errorHandler: fail,
		serviceErrorHandler: fail,
	});
	process.exit(SUCCESS_EXIT_CODE);
} catch (error) {
	fail(error);
}
