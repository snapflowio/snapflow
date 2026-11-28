/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { buildContextObjectKey } from '../constants/build-context.constants';
import { UPLOAD_CREDENTIAL_LIFETIME_SECONDS } from '../constants/object-storage-credential.constants';
import type { BuildContextUploadsDto } from '../dto/build-context-upload.dto';
import {
	normalizeBuildContextHashes,
	ObjectStorageService,
} from './object-storage.service';
import { ObjectStorageCredentialService } from './object-storage-credential.service';

@Injectable()
export class BuildContextUploadService {
	constructor(
		private readonly objectStorage: ObjectStorageService,
		private readonly credentials: ObjectStorageCredentialService
	) {}

	async createUploads(
		organizationId: string,
		contextHashes: readonly string[]
	): Promise<BuildContextUploadsDto> {
		const targets = normalizeBuildContextHashes(contextHashes).map((hash) => ({
			hash,
			key: buildContextObjectKey(organizationId, hash),
		}));
		const existing = await this.objectStorage.existingObjects(
			targets.map(({ key }) => key)
		);
		const missingKeys = targets
			.map(({ key }) => key)
			.filter((key) => !existing.has(key));
		const credential =
			missingKeys.length > 0
				? await this.credentials.issueUpload({
						keys: missingKeys,
						ttlSeconds: UPLOAD_CREDENTIAL_LIFETIME_SECONDS.BUILD_CONTEXT,
					})
				: undefined;
		return {
			...this.objectStorage.location(),
			credential,
			uploads: targets.map((target) => ({
				...target,
				exists: existing.has(target.key),
			})),
		};
	}
}
