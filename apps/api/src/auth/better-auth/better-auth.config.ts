/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import type { MikroORM } from '@mikro-orm/postgresql';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import type Redis from 'ioredis';
import { CLIENT_IP_HEADER } from '../../common/constants/client-ip.constants';
import type { OrganizationService } from '../../organization/services/organization.service';
import type { OrganizationOwnershipService } from '../../organization/services/organization-ownership.service';
import {
	AUTH_BASE_PATH,
	DISABLED_AUTH_PATHS,
} from '../constants/auth-paths.constants';
import { AUTH_PRODUCT_NAME } from '../constants/auth-product.constants';
import {
	AUTH_RATE_LIMIT_RULES,
	SESSION_FRESH_AGE_SECONDS,
} from '../constants/auth-security.constants';
import { assertAccountDeletable } from './account/account-deletion';
import {
	type AuthDatabaseHookDependencies,
	createAuthDatabaseHooks,
} from './hooks/database.hooks';
import {
	type AuthHookDependencies,
	createAuthHooks,
} from './hooks/request.hooks';
import {
	type AuthPluginDependencies,
	createAuthPlugins,
} from './plugins/auth.plugin';
import { createSocialSignIn } from './plugins/social-providers';
import {
	SESSION_ADDITIONAL_FIELDS,
	USER_ADDITIONAL_FIELDS,
} from './schema/additional-fields';
import { createRedisSecondaryStorage } from './storage/redis-secondary-storage';

const DATABASE_TYPE = 'postgres';
const SECURE_ORIGIN_PREFIX = 'https://';
const SECURE_COOKIE_PREFIX = '__Host-snapflow';
const COOKIE_PREFIX = 'snapflow';

export interface AuthConfigOptions
	extends AuthDatabaseHookDependencies,
		AuthHookDependencies,
		AuthPluginDependencies {
	orm: MikroORM;
	redis: Redis;
	organizations: OrganizationService;
	ownership: OrganizationOwnershipService;
}

function createBetterAuthDatabase(orm: MikroORM) {
	return {
		db: orm.em.fork().getKysely({ convertValues: true }),
		type: DATABASE_TYPE,
		transaction: true,
	} satisfies BetterAuthOptions['database'];
}

export const createAuthConfig = (options: AuthConfigOptions) => {
	const { configService, orm, ownership, redis } = options;
	const authBaseUrl = configService.get('authBaseUrl');
	const allowedHosts = [
		...new Set(
			configService
				.get('trustedWebOrigins')
				.map((origin) => new URL(origin).host)
		),
	];
	const secureCookies = authBaseUrl.startsWith(SECURE_ORIGIN_PREFIX);

	return betterAuth({
		appName: AUTH_PRODUCT_NAME,
		database: createBetterAuthDatabase(orm),
		secondaryStorage: createRedisSecondaryStorage(redis),
		secrets: configService.get('betterAuthSecrets'),
		trustedOrigins: configService.get('trustedBrowserOrigins'),
		basePath: AUTH_BASE_PATH,
		disabledPaths: DISABLED_AUTH_PATHS,
		baseURL: {
			allowedHosts,
			protocol: secureCookies ? 'https' : 'auto',
			fallback: authBaseUrl,
		},
		rateLimit: {
			enabled: true,
			storage: 'secondary-storage',
			customRules: AUTH_RATE_LIMIT_RULES,
		},
		advanced: {
			cookiePrefix: secureCookies ? SECURE_COOKIE_PREFIX : COOKIE_PREFIX,
			useSecureCookies: secureCookies,
			ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
			database: { generateId: () => randomUUID() },
		},
		session: {
			freshAge: SESSION_FRESH_AGE_SECONDS,
			storeSessionInDatabase: true,
			additionalFields: SESSION_ADDITIONAL_FIELDS,
		},
		verification: { storeIdentifier: 'hashed', storeInDatabase: false },
		user: {
			additionalFields: USER_ADDITIONAL_FIELDS,
			deleteUser: {
				enabled: true,
				beforeDelete: (user) => assertAccountDeletable(ownership, user.id),
			},
			validateUserInfo: ({ user, source }) =>
				source.method === 'oauth' && user.emailVerified !== true
					? {
							error: 'email_not_verified',
							errorDescription:
								'Verify your email address with the provider before signing in to Snapflow.',
						}
					: undefined,
		},
		...createSocialSignIn(configService),
		databaseHooks: createAuthDatabaseHooks(options),
		hooks: createAuthHooks(options),
		plugins: createAuthPlugins(options),
	} satisfies BetterAuthOptions);
};

export type Auth = ReturnType<typeof createAuthConfig>;
