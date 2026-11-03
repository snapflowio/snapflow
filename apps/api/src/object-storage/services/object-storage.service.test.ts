/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { fakeInstance } from '../../common/testing/instance.fake';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ObjectStorageService } from './object-storage.service';

const BUCKET = 'snapflow-test';
const STORAGE_CONFIG: Readonly<Record<string, string>> = {
	's3.endpoint': 'http://storage.invalid:9000',
	's3.region': 'us-east-1',
	's3.accessKey': 'test-access-key',
	's3.secretKey': 'test-secret-key',
	's3.defaultBucket': BUCKET,
};
const SIGNED_HEADERS_PARAMETER = 'X-Amz-SignedHeaders';
const PACK_KEY = 'organization/volume-backups/volume/artifact.pack';
const MANIFEST_KEY = 'organization/volume-backups/volume/artifact.manifest';

function storage(): ObjectStorageService {
	const config = fakeInstance(TypedConfigService);
	const read = (key: string) => STORAGE_CONFIG[key];
	mock.method(config, 'get', read);
	mock.method(config, 'getOrThrow', read);
	return new ObjectStorageService(config);
}

describe('ObjectStorageService volume backups', () => {
	it('signs downloads without Range so the holder may read any byte range', async () => {
		const url = new URL(await storage().createVolumeBackupDownload(PACK_KEY));

		assert.equal(url.pathname, `/${BUCKET}/${PACK_KEY}`);
		assert.equal(url.searchParams.get(SIGNED_HEADERS_PARAMETER), 'host');
	});

	it('signs uploads for exactly the requested object', async () => {
		const url = new URL(await storage().createVolumeBackupUpload(MANIFEST_KEY));

		assert.equal(url.pathname, `/${BUCKET}/${MANIFEST_KEY}`);
		assert.doesNotMatch(
			url.searchParams.get(SIGNED_HEADERS_PARAMETER) ?? '',
			/range/
		);
	});
});
