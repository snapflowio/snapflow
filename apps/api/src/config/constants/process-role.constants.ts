/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ProcessRole } from '../enums/process-role.enum';
import type { ProcessRoleTraits } from '../types/process-role.types';

export const PROCESS_ROLE_TRAITS: Readonly<
	Record<ProcessRole, ProcessRoleTraits>
> = {
	[ProcessRole.API]: { servesHttp: true, runsScheduledJobs: false },
	[ProcessRole.WORKER]: { servesHttp: false, runsScheduledJobs: true },
	[ProcessRole.ALL]: { servesHttp: true, runsScheduledJobs: true },
};

export const ONE_OFF_DATABASE_POOL_MAX = 1;
