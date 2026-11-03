/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BetterAuthPlugin } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import type { TypedConfigService } from '../../../config/services/typed-config.service';
import type { EmailService } from '../../../infra/email/services/email.service';
import {
	createOrganizationPlugins,
	type OrganizationPluginDependencies,
} from '../../../organization/tenant/better-auth/organization-plugin';
import { createAdminPlugin } from './admin.plugin';
import { createApiKeyPlugin } from './api-key.plugin';
import { createDeviceAuthorizationPlugin } from './device-authorization.plugin';
import { createEmailOtpPlugin } from './email-otp.plugin';
import { createLastLoginMethodPlugin } from './last-login-method.plugin';
import { createPasskeyPlugin } from './passkey.plugin';
import { createTwoFactorPlugin } from './two-factor.plugin';

export interface AuthPluginDependencies
	extends Omit<
		OrganizationPluginDependencies,
		'dashboardUrl' | 'emailService'
	> {
	configService: TypedConfigService;
	emailService: EmailService;
}

export function createAuthPlugins(dependencies: AuthPluginDependencies) {
	const { configService, emailService } = dependencies;
	const dashboardUrl = configService.getOrThrow('dashboardUrl');

	return pluginTuple(
		createAdminPlugin(),
		createEmailOtpPlugin(emailService),
		createTwoFactorPlugin(),
		createApiKeyPlugin(),
		createPasskeyPlugin(configService),
		createLastLoginMethodPlugin(),
		createDeviceAuthorizationPlugin(dashboardUrl),
		bearer(),
		...createOrganizationPlugins({ ...dependencies, dashboardUrl })
	);
}

function pluginTuple<const Plugins extends BetterAuthPlugin[]>(
	...plugins: Plugins
): Plugins {
	return plugins;
}
