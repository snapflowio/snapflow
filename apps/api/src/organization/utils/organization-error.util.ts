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
import { ORGANIZATION_ERROR } from '../constants/organization-errors.constants';

export function organizationNotFound(organizationId: string): ApiErrorBody {
	return apiError(
		ORGANIZATION_ERROR.ORGANIZATION_NOT_FOUND.code,
		`Organization ${organizationId} was not found. Check the organization ID; it may have been deleted.`
	);
}
