/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { deviceAuthorization } from 'better-auth/plugins';
import {
	CLI_DEVICE_CLIENT_ID,
	DEVICE_CODE_EXPIRES_IN,
	DEVICE_CODE_POLL_INTERVAL,
	DEVICE_USER_CODE_LENGTH,
	DEVICE_VERIFICATION_PATH,
} from '../../constants/device-authorization.constants';

export const createDeviceAuthorizationPlugin = (dashboardUrl: string) =>
	deviceAuthorization({
		expiresIn: DEVICE_CODE_EXPIRES_IN,
		interval: DEVICE_CODE_POLL_INTERVAL,
		userCodeLength: DEVICE_USER_CODE_LENGTH,
		validateClient: (clientId) => clientId === CLI_DEVICE_CLIENT_ID,
		verificationUri: `${dashboardUrl}${DEVICE_VERIFICATION_PATH}`,
	});
