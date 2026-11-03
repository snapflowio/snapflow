/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SystemRole } from '../../user/enums/system-role.enum';
export interface BaseAuthContext {
	role: SystemRole | 'machine' | 'health-check';
}

export function isBaseAuthContext(user: unknown): user is BaseAuthContext {
	return typeof user === 'object' && user !== null && 'role' in user;
}
