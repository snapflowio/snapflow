/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { AuthMethod } from '../constants/auth-method.constants';

export { AuthMethod } from '../constants/auth-method.constants';

export const ALLOW_AUTH_METHODS_KEY = 'allowAuthMethods';

export function AllowAuthMethods(
	methods: readonly AuthMethod[]
): ClassDecorator & MethodDecorator {
	const uniqueMethods = [...new Set(methods)];
	if (uniqueMethods.length === 0) {
		throw new TypeError('At least one authentication method must be allowed.');
	}

	return applyDecorators(
		SetMetadata(ALLOW_AUTH_METHODS_KEY, uniqueMethods),
		...(uniqueMethods.includes(AuthMethod.API_KEY) ? [ApiBearerAuth()] : []),
		...(uniqueMethods.includes(AuthMethod.SESSION)
			? [ApiCookieAuth('snapflow.session_token')]
			: [])
	);
}
