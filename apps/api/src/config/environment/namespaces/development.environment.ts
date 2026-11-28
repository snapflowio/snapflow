/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { DEVELOPMENT_ONLY } from '../../constants/deployment-environment.constants';
import { text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

const developmentSecret = (description: string) =>
	environmentVariable(text().optional(), {
		description,
		secret: true,
		allowedIn: DEVELOPMENT_ONLY,
	});

export const developmentEnvironment = defineEnvironment(
	{
		title: 'Development',
		description:
			'Secrets of the local development stack, shared with its other services',
	},
	{
		SNAPFLOW_DEVELOPMENT_EDGE_ENROLLMENT_SECRET: developmentSecret(
			'Enrollment secret of the local edge (its SNAPFLOW_EDGE_ENROLLMENT_SECRET).'
		),
		SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET: developmentSecret(
			'Enrollment secret the local machine registers itself with (its SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET).'
		),
	}
);
