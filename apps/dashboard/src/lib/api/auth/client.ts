/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { apiKeyClient } from '@better-auth/api-key/client';
import { passkeyClient } from '@better-auth/passkey/client';
import {
	ORGANIZATION_ADDITIONAL_FIELDS,
	ORGANIZATION_ROLE_ADDITIONAL_FIELDS,
	ORGANIZATION_ROLES,
	organizationAccessControl,
} from '@snapflow/organization-access';
import {
	adminClient,
	deviceAuthorizationClient,
	emailOTPClient,
	inferAdditionalFields,
	inferOrgAdditionalFields,
	lastLoginMethodClient,
	organizationClient,
	twoFactorClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte';
import { withAdminMfaStepUp } from '#lib/api/admin/mfa-fetch.ts';
import { reauthentication } from '#lib/api/auth/reauthentication.svelte.ts';
import { AUTH_PATH } from '#lib/config/service-paths.ts';

const LAST_LOGIN_METHOD_COOKIE = 'snapflow.last_used_login_method';

export const authClient = createAuthClient({
	baseURL: window.location.origin,
	basePath: AUTH_PATH,
	fetchOptions: {
		customFetchImpl: withAdminMfaStepUp(fetch),
		onError: ({ error }) => reauthentication.requestIfNotFresh(error),
	},
	plugins: [
		emailOTPClient(),
		passkeyClient(),
		twoFactorClient(),
		adminClient(),
		apiKeyClient(),
		lastLoginMethodClient({ cookieName: LAST_LOGIN_METHOD_COOKIE }),
		deviceAuthorizationClient(),
		organizationClient({
			ac: organizationAccessControl,
			roles: ORGANIZATION_ROLES,
			dynamicAccessControl: { enabled: true },
			schema: inferOrgAdditionalFields({
				organization: { additionalFields: ORGANIZATION_ADDITIONAL_FIELDS },
				organizationRole: {
					additionalFields: ORGANIZATION_ROLE_ADDITIONAL_FIELDS,
				},
			}),
		}),
		inferAdditionalFields({
			session: {
				secondFactorVerifiedAt: { type: 'date', required: false, input: false },
			},
		}),
	],
});
