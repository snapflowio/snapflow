/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { apiKey } from '@better-auth/api-key';
import {
	API_KEY_MAX_EXPIRATION_DAYS,
	API_KEY_MIN_EXPIRATION_DAYS,
	API_KEY_NAME_MAX_LENGTH,
	API_KEY_PREFIX,
	API_KEY_VISIBLE_CHARACTERS,
} from '../../constants/api-key.constants';
import { apiKeyFromHeaders } from '../../utils/api-key-header.util';

export const createApiKeyPlugin = () =>
	apiKey({
		defaultPrefix: API_KEY_PREFIX,
		references: 'organization',
		enableMetadata: true,
		customAPIKeyGetter: (context) =>
			context.headers ? apiKeyFromHeaders(context.headers) : null,
		maximumNameLength: API_KEY_NAME_MAX_LENGTH,
		requireName: true,
		startingCharactersConfig: {
			charactersLength: API_KEY_VISIBLE_CHARACTERS,
		},
		keyExpiration: {
			minExpiresIn: API_KEY_MIN_EXPIRATION_DAYS,
			maxExpiresIn: API_KEY_MAX_EXPIRATION_DAYS,
		},
		rateLimit: { enabled: false },
	});
