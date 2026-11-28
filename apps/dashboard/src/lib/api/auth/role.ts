/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const AUTH_ROLE = {
	ADMIN: 'admin',
	USER: 'user',
} as const;

export type AuthRole = (typeof AUTH_ROLE)[keyof typeof AUTH_ROLE];

export function hasAuthRole(
	role: string | string[] | null | undefined,
	expectedRole: AuthRole
): boolean {
	const roles = Array.isArray(role) ? role : (role?.split(',') ?? []);
	return roles.some((candidate) => candidate.trim() === expectedRole);
}
