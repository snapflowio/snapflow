/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';

const ENTITY_TAG_PATTERN = /^(?:W\/)?"?(\d+)"?$/;

export function parseRequiredResourceVersion(
	ifMatch: string | undefined
): number {
	const match = ifMatch?.trim().match(ENTITY_TAG_PATTERN);
	if (!match) {
		throw new BadRequestException('If-Match resource version is required');
	}
	const version = Number(match[1]);
	if (!Number.isSafeInteger(version) || version < 1) {
		throw new BadRequestException('If-Match resource version is invalid');
	}
	return version;
}
