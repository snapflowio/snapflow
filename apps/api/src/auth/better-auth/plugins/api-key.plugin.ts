/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { apiKey } from '@better-auth/api-key';
import { SECONDS_PER_DAY } from '../../../common/constants/time.constants';
import {
	API_KEY_CONFIG_ID,
	API_KEY_MAX_EXPIRATION_DAYS,
	API_KEY_MIN_EXPIRATION_DAYS,
	API_KEY_NAME_MAX_LENGTH,
	API_KEY_PREFIX,
	API_KEY_VISIBLE_CHARACTERS,
	API_KEY_VISIBLE_SECRET_CHARACTERS,
} from '../../constants/api-key.constants';
import {
	MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS,
	MACHINE_ENROLLMENT_KEY_PREFIX,
} from '../../constants/machine-enrollment-key.constants';
import { apiKeyFromHeaders } from '../../utils/api-key-header.util';

const ORGANIZATION_REFERENCE = 'organization';

export const createApiKeyPlugin = () =>
	apiKey([
		{
			configId: API_KEY_CONFIG_ID.DEFAULT,
			defaultPrefix: API_KEY_PREFIX,
			references: ORGANIZATION_REFERENCE,
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
		},
		{
			configId: API_KEY_CONFIG_ID.MACHINE_ENROLLMENT,
			defaultPrefix: MACHINE_ENROLLMENT_KEY_PREFIX,
			references: ORGANIZATION_REFERENCE,
			enableMetadata: true,
			maximumNameLength: API_KEY_NAME_MAX_LENGTH,
			requireName: true,
			startingCharactersConfig: {
				charactersLength:
					MACHINE_ENROLLMENT_KEY_PREFIX.length +
					API_KEY_VISIBLE_SECRET_CHARACTERS,
			},
			keyExpiration: {
				minExpiresIn:
					MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.MINIMUM / SECONDS_PER_DAY,
				maxExpiresIn:
					MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.REUSABLE_MAXIMUM /
					SECONDS_PER_DAY,
			},
			rateLimit: { enabled: false },
		},
	]);
