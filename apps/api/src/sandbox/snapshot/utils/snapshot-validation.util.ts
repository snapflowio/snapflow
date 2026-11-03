/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { LATEST_IMAGE_TAG } from '../../../common/constants/image-reference.constants';
import {
	ImageReference,
	ImageReferenceError,
} from '../../../common/values/image-reference.value';

const SNAPSHOT_NAME_PATTERN =
	/^[a-zA-Z0-9_.\-:]+(\/[a-zA-Z0-9_.\-:]+)*(@sha256:[a-f0-9]{64})?$/;

export function assertValidSnapshotName(name: string): void {
	if (!SNAPSHOT_NAME_PATTERN.test(name)) {
		throw new BadRequestException(
			'Invalid snapshot name format. May contain letters, digits, dots, colons, and dashes'
		);
	}
}

export function assertValidImageName(name: string): void {
	const image = parseImageReference(name);
	if (image.tag === undefined && image.digest === undefined) {
		throw new BadRequestException(
			'Image name must include a tag (e.g., ubuntu:24.04) or digest (@sha256:...)'
		);
	}
	if (image.digest === undefined && image.tag === LATEST_IMAGE_TAG) {
		throw new BadRequestException(
			'Images with tag ":latest" are not allowed; pin a fixed tag or a digest'
		);
	}
}

function parseImageReference(name: string): ImageReference {
	try {
		return ImageReference.parse(name);
	} catch (error) {
		if (error instanceof ImageReferenceError) {
			throw new BadRequestException(error.message);
		}
		throw error;
	}
}

export function normalizeEntrypoint(
	entrypoint?: string[]
): string[] | undefined {
	const parts = entrypoint?.filter((part) => part.trim().length > 0) ?? [];
	return parts.length > 0 ? parts : undefined;
}
