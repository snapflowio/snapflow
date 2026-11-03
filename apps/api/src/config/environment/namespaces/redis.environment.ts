/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redisUrlText } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const redisEnvironment = defineEnvironment(
	{
		name: 'redis',
		title: 'Redis',
		description: 'Redis: locks, throttling, realtime fan-out and caches',
	},
	{
		REDIS_URL: environmentVariable(redisUrlText(), {
			description:
				'Redis URL redis://[user:password@]host:port (rediss:// for TLS), without a database index: the API uses databases 0 and 1.',
			secret: true,
		}),
	}
);
