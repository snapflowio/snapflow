/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const geoIpEnvironment = defineEnvironment(
	{
		title: 'IP Geolocation',
		description:
			'The IP geolocation database that locates machines and the callers placing sandboxes',
	},
	{
		SNAPFLOW_GEOIP_DATABASE_PATH: environmentVariable(text(), {
			description:
				'Path of the DB-IP City Lite database (MaxMind DB format); the API image ships it, and apps/api/scripts/download-geoip-database.sh fetches it for development.',
		}),
	}
);
