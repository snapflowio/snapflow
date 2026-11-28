/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const DEFAULT_MAX_LENGTH = 10_000;
const TRUNCATION_SEPARATOR = '\n\n... [truncated] ...\n\n';

export function truncateErrorMessage(
	message: string,
	maxLength = DEFAULT_MAX_LENGTH
): string {
	if (!message || message.length <= maxLength) {
		return message;
	}

	const firstNewline = message.indexOf('\n');
	const firstLine =
		firstNewline === -1 ? message : message.slice(0, firstNewline);

	if (firstLine.length + TRUNCATION_SEPARATOR.length >= maxLength) {
		return firstLine.slice(0, maxLength);
	}

	const tailBudget = maxLength - firstLine.length - TRUNCATION_SEPARATOR.length;
	const tail = message.slice(-tailBudget);

	return firstLine + TRUNCATION_SEPARATOR + tail;
}
