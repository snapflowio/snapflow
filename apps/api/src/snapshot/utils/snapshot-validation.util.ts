/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { LATEST_IMAGE_TAG } from '../../common/constants/image-reference.constants';
import { apiError } from '../../common/utils/error/api-error.util';
import { isPublicHost } from '../../common/utils/ip-address.util';
import {
	ImageReference,
	ImageReferenceError,
} from '../../common/values/image-reference.value';
import { SnapshotErrorCode } from '../enums/snapshot-error-code.enum';

const SNAPSHOT_NAME_PATTERN =
	/^[a-zA-Z0-9_.\-:]+(\/[a-zA-Z0-9_.\-:]+)*(@sha256:[a-f0-9]{64})?$/;

export function assertValidSnapshotName(name: string): void {
	if (!SNAPSHOT_NAME_PATTERN.test(name)) {
		throw new BadRequestException(
			apiError(
				SnapshotErrorCode.NAME_INVALID,
				'The snapshot name is invalid. Use only letters, digits, dots, colons and dashes.'
			)
		);
	}
}

export function assertValidImageName(name: string): void {
	const image = parseImageReference(name);
	if (image.tag === undefined && image.digest === undefined) {
		throw new BadRequestException(
			apiError(
				SnapshotErrorCode.IMAGE_NAME_INVALID,
				'The image name needs a tag such as ubuntu:24.04 or a digest such as @sha256:... Add one and try again.'
			)
		);
	}
	if (image.digest === undefined && image.tag === LATEST_IMAGE_TAG) {
		throw new BadRequestException(
			apiError(
				SnapshotErrorCode.IMAGE_NAME_INVALID,
				'Images tagged :latest are not allowed. Pin a fixed tag or a digest and try again.'
			)
		);
	}
}

export function assertPublicImageRegistry(name: string): void {
	if (isPublicHost(parseImageReference(name).domain)) return;
	throw new BadRequestException(
		apiError(
			SnapshotErrorCode.IMAGE_NAME_INVALID,
			'The image registry must be a public host, not localhost, a private network or a link-local address.'
		)
	);
}

function parseImageReference(name: string): ImageReference {
	try {
		return ImageReference.parse(name);
	} catch (error) {
		if (error instanceof ImageReferenceError) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.IMAGE_NAME_INVALID,
					`The image name is invalid: ${error.message} Correct it and try again.`
				),
				{ cause: error }
			);
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
