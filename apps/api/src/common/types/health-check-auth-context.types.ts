/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BaseAuthContext, isBaseAuthContext } from './base-auth-context.types';

export interface HealthCheckAuthContext extends BaseAuthContext {
	role: 'health-check';
}

export function isHealthCheckAuthContext(
	user: unknown
): user is HealthCheckAuthContext {
	return isBaseAuthContext(user) && user.role === 'health-check';
}
