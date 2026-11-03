/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Organization } from '../entities/organization.entity';

export function isSuspensionActive(
	organization: Pick<Organization, 'suspended' | 'suspendedUntil'>,
	now: Date = new Date()
): boolean {
	return (
		organization.suspended &&
		(organization.suspendedUntil === null || organization.suspendedUntil > now)
	);
}
