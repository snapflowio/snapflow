/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DeploymentEnvironment } from '../enums/deployment-environment.enum';
import type { DeploymentProfile } from '../types/deployment-profile.types';

export const DEPLOYMENT_PROFILES: Readonly<
	Record<DeploymentEnvironment, DeploymentProfile>
> = {
	[DeploymentEnvironment.DEVELOPMENT]: {
		name: DeploymentEnvironment.DEVELOPMENT,
		hosted: false,
		developerConsole: true,
	},
	[DeploymentEnvironment.PRODUCTION]: {
		name: DeploymentEnvironment.PRODUCTION,
		hosted: true,
		developerConsole: false,
	},
};
