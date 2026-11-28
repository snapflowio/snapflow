/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { captcha } from 'better-auth/plugins';
import type { TypedConfigService } from '../../../config/services/typed-config.service';
import {
	HUMAN_VERIFICATION_ACTION,
	HUMAN_VERIFIED_AUTH_PATHS,
} from '../../constants/auth-paths.constants';

const TURNSTILE_PROVIDER = 'cloudflare-turnstile';

export function createCaptchaPlugin(configService: TypedConfigService) {
	const { secretKey } = configService.get('humanVerification');
	const allowedHostnames = configService
		.get('trustedBrowserOrigins')
		.map((origin) => new URL(origin).hostname);
	return captcha({
		provider: TURNSTILE_PROVIDER,
		secretKey,
		endpoints: HUMAN_VERIFIED_AUTH_PATHS,
		...(configService.get('deployment').hosted && {
			expectedAction: HUMAN_VERIFICATION_ACTION,
			allowedHostnames: [...new Set(allowedHostnames)],
		}),
	});
}
