/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SettingsSnapshot } from '../../settings/types/settings.types';
import type { OrganizationLimits } from '../entities/organization-limits.entity';

export function archiveAfterStoppedDays(
	limits: Pick<OrganizationLimits, 'archiveAfterStoppedDays'>,
	settings: Pick<SettingsSnapshot, 'archiveAfterStoppedDaysDefault'>
): number {
	return (
		limits.archiveAfterStoppedDays ?? settings.archiveAfterStoppedDaysDefault
	);
}
