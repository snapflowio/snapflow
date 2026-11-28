/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type ErrorCode, isKnownErrorCode } from './error-catalog.ts';
import { SnapflowError } from './snapflow-error.ts';

export function apiErrorCode(error: unknown): ErrorCode | null {
	const { code } = SnapflowError.fromUnknown(error);
	return isKnownErrorCode(code) ? code : null;
}

export function userErrorMessage(error: unknown): string {
	return SnapflowError.fromUnknown(error).message;
}

export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
	return SnapflowError.fromUnknown(error).code === code;
}
