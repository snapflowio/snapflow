/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ExecutionContext } from '@nestjs/common';
import { InvalidAuthenticationContextException } from '../exceptions/invalid-authentication-context.exception';
import { BaseAuthContext } from '../types/base-auth-context.types';

export function getAuthContext<T extends BaseAuthContext>(
	context: ExecutionContext,
	isFunction: (user: unknown) => user is T
): T {
	const request = context.switchToHttp().getRequest();

	if (request.user && isFunction(request.user)) {
		return request.user;
	}

	throw new InvalidAuthenticationContextException();
}
