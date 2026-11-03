/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const CORS_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

export function corsOptions(trustedOrigins: readonly string[]): CorsOptions {
	return {
		origin: [...trustedOrigins],
		methods: CORS_METHODS,
		credentials: true,
	};
}
