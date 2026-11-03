/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BetterAuthOptions } from 'better-auth';
import type { TypedConfigService } from '../../../config/services/typed-config.service';
import { SocialProvider } from '../../constants/social-provider.constants';

export function enabledSocialProviders(
	configService: TypedConfigService
): SocialProvider[] {
	const { google, github } = configService.get('socialSignIn');
	return [
		...(google ? [SocialProvider.GOOGLE] : []),
		...(github ? [SocialProvider.GITHUB] : []),
	];
}

export function createSocialSignIn(
	configService: TypedConfigService
): Pick<BetterAuthOptions, 'socialProviders' | 'account'> {
	const { google, github } = configService.get('socialSignIn');
	return {
		socialProviders: {
			...(google && { google: { ...google, prompt: 'select_account' } }),
			...(github && { github }),
		},
		account: {
			accountLinking: { enabled: true, allowDifferentEmails: false },
		},
	};
}
