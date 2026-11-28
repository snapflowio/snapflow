/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ForbiddenException } from '@nestjs/common';
import {
	ADMIN_MFA_REQUIRED_CODE,
	ADMIN_MFA_REQUIRED_MESSAGE,
} from '../constants/admin-access.constants';

export class AdminMfaRequiredException extends ForbiddenException {
	constructor() {
		super({
			code: ADMIN_MFA_REQUIRED_CODE,
			message: ADMIN_MFA_REQUIRED_MESSAGE,
		});
	}
}
