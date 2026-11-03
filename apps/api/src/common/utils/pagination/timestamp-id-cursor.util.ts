/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

const CURSOR_SEPARATOR = ':';

export interface TimestampIdCursor {
	timestamp: Date;
	id: string;
}

export function encodeTimestampIdCursor(cursor: TimestampIdCursor): string {
	return Buffer.from(
		`${cursor.timestamp.getTime()}${CURSOR_SEPARATOR}${cursor.id}`
	).toString('base64url');
}

export function decodeTimestampIdCursor(
	value: string,
	description: string
): TimestampIdCursor {
	const decoded = Buffer.from(value, 'base64url').toString('utf8');
	const separator = decoded.indexOf(CURSOR_SEPARATOR);
	const timestampText = decoded.slice(0, separator);
	const id = decoded.slice(separator + CURSOR_SEPARATOR.length);
	const timestamp = Number(timestampText);
	if (
		separator <= 0 ||
		!Number.isSafeInteger(timestamp) ||
		timestamp < 0 ||
		!isUUID(id)
	) {
		throw new BadRequestException(`${description} cursor is invalid`);
	}
	return { timestamp: new Date(timestamp), id };
}
