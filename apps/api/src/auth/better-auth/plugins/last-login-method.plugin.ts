/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { lastLoginMethod } from 'better-auth/plugins';

const LAST_LOGIN_METHOD_COOKIE = 'snapflow.last_used_login_method';

export const createLastLoginMethodPlugin = () =>
	lastLoginMethod({ cookieName: LAST_LOGIN_METHOD_COOKIE });
