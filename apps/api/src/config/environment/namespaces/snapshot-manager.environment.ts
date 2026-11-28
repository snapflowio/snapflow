/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { httpUrlText } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const snapshotManagerEnvironment = defineEnvironment(
	{
		title: 'Snapshot Manager',
		description:
			'The platform registry that stores snapshot images, backups and build caches',
	},
	{
		SNAPFLOW_SNAPSHOT_MANAGER_URL: environmentVariable(httpUrlText(), {
			description: 'URL machines and builders reach the snapshot manager at.',
		}),
	}
);
