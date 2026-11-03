/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { admin } from 'better-auth/plugins';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { IMPERSONATION_SESSION_DURATION_SECONDS } from '../../constants/auth-security.constants';

const BANNED_USER_MESSAGE =
	'This account has been suspended. Contact Snapflow support if you believe this is an error.';

export const createAdminPlugin = () =>
	admin({
		defaultRole: SystemRole.USER,
		adminRoles: [SystemRole.ADMIN],
		impersonationSessionDuration: IMPERSONATION_SESSION_DURATION_SECONDS,
		bannedUserMessage: BANNED_USER_MESSAGE,
	});
