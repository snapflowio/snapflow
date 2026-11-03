/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	positiveIntegerText,
	postgresUrlText,
} from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const databaseEnvironment = defineEnvironment(
	{
		name: 'database',
		title: 'Database',
		description:
			'PostgreSQL; one-off processes (migrations, CLI) use a single connection',
	},
	{
		DATABASE_URL: environmentVariable(postgresUrlText(), {
			description:
				'PostgreSQL connection URL; each deployment has its own database. TLS follows its libpq sslmode and sslrootcert parameters; hosted deployments require sslmode=verify-full.',
			secret: true,
		}),
		DATABASE_POOL_MAX: environmentVariable(positiveIntegerText(), {
			description:
				'Maximum pooled connections of each long-running API or worker process.',
		}),
		DATABASE_POOL_IDLE_TIMEOUT_MS: environmentVariable(positiveIntegerText(), {
			description:
				'Milliseconds an idle pooled connection stays open before it is closed.',
		}),
		DATABASE_CONNECTION_TIMEOUT_MS: environmentVariable(positiveIntegerText(), {
			description:
				'Milliseconds to wait for a new database connection before failing.',
		}),
	}
);
