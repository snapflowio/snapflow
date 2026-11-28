/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import { ORGANIZATION_ERROR } from '../../organization/constants/organization-errors.constants';

export function assertOrganizationContext(
	assertedOrganizationId: unknown,
	activeOrganizationId: string
): void {
	if (
		assertedOrganizationId !== undefined &&
		assertedOrganizationId !== activeOrganizationId
	) {
		throw new ConflictException(ORGANIZATION_ERROR.CONTEXT_CHANGED);
	}
}
