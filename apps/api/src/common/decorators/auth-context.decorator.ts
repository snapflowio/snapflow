/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { BaseAuthContext } from '../types/base-auth-context.types';
import { isMachineAuthContext } from '../types/machine-auth-context.types';
import { isOrganizationAuthContext } from '../types/organization-auth-context.types';
import { getAuthContext } from '../utils/auth-context.util';

const AuthContext = createParamDecorator(
	<T extends BaseAuthContext>(
		isFunction: (user: unknown) => user is T,
		ctx: ExecutionContext
	): T => getAuthContext(ctx, isFunction)
);

export const IsOrganizationAuthContext = () =>
	AuthContext(isOrganizationAuthContext);

export const IsMachineAuthContext = () => AuthContext(isMachineAuthContext);
