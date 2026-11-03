/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { sentenceCase } from '#lib/utils/text.ts';

const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;

export function credentialLoadErrorMessage(
	error: Error | null,
	noun: string
): string {
	if (error instanceof SnapflowError && error.status === NOT_FOUND_STATUS) {
		return `${sentenceCase(noun)} not found.`;
	}
	if (error instanceof SnapflowError && error.status === FORBIDDEN_STATUS) {
		return `You do not have access to this ${noun}.`;
	}
	return `Could not load this ${noun}.`;
}
