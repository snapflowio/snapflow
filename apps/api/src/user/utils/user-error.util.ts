/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ApiErrorBody,
	apiError,
} from '../../common/utils/error/api-error.util';
import { UserErrorCode } from '../enums/user-error-code.enum';

export function userNotFound(userId: string): ApiErrorBody {
	return apiError(
		UserErrorCode.NOT_FOUND,
		`User ${userId} was not found. Check the user ID; the account may have been deleted.`
	);
}
