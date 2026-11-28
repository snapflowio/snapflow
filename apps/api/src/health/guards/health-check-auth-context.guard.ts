/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { isHealthCheckAuthContext } from '../../common/types/health-check-auth-context.types';
import { getAuthContext } from '../../common/utils/auth-context.util';

@Injectable()
export class HealthCheckAuthContextGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		getAuthContext(context, isHealthCheckAuthContext);
		return true;
	}
}
