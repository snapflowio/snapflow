/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SystemRole } from '../../user/enums/system-role.enum';

export const PLATFORM_PRINCIPAL_TYPE = {
	HUMAN: 'human',
} as const;
export type PlatformPrincipalType =
	(typeof PLATFORM_PRINCIPAL_TYPE)[keyof typeof PLATFORM_PRINCIPAL_TYPE];

export interface HumanPrincipal {
	type: typeof PLATFORM_PRINCIPAL_TYPE.HUMAN;
	id: string;
	email: string;
	displayName: string;
	systemRole: SystemRole;
}
