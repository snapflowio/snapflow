/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { authClient } from './client.ts';

type DeleteUserResult = Awaited<ReturnType<typeof authClient.deleteUser>>;

export type AccountDeletionError = NonNullable<DeleteUserResult['error']>;

export function updateProfileName(
	name: string
): ReturnType<typeof authClient.updateUser> {
	return authClient.updateUser({ name });
}

export function deleteUserAccount(): Promise<DeleteUserResult> {
	return authClient.deleteUser();
}
