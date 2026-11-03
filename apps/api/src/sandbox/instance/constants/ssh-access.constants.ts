/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SSH_ACCESS = {
	defaultLifetimeMinutes: 60,
	minimumLifetimeMinutes: 1,
	maximumLifetimeMinutes: 8 * 60,
	standardPort: 22,
} as const;
