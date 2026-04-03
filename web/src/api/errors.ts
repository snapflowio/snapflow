/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export class SnapflowError extends Error {
	public static fromError(error: Error): SnapflowError {
		if (String(error).includes('Organization is suspended'))
			return new OrganizationSuspendedError(error.message);

		return new SnapflowError(error.message);
	}

	public static fromString(error: string): SnapflowError {
		return SnapflowError.fromError(new Error(error));
	}
}

export class OrganizationSuspendedError extends SnapflowError {}
