/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import {
	AssumeRoleCommand,
	type AssumeRoleCommandOutput,
	STSClient,
} from '@aws-sdk/client-sts';
import { ServiceUnavailableException } from '@nestjs/common';
import { fakeInstance } from '../../common/testing/instance.fake';
import { ObjectStorageProvider } from '../../config/enums/object-storage-provider.enum';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ObjectStoragePushAccessService } from './object-storage-push-access.service';

const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const BUCKET = 'snapflow';
const INTERNAL_DETAIL = 'AccessDenied: internal storage policy root-admin';
const S3_COMPATIBLE_SETTINGS: Readonly<Record<string, string>> = {
	's3.endpoint': 'http://rustfs:9000',
	's3.defaultBucket': BUCKET,
	's3.region': 'us-east-1',
	's3.accessKey': 'storage-access',
	's3.secretKey': 'storage-secret',
	's3.provider': ObjectStorageProvider.S3_COMPATIBLE,
};

function service(): ObjectStoragePushAccessService {
	const setting = (key: string) => S3_COMPATIBLE_SETTINGS[key];
	return new ObjectStoragePushAccessService(
		fakeInstance(TypedConfigService, { get: setting, getOrThrow: setting })
	);
}

function stsResponds(
	respond: (command: AssumeRoleCommand) => Partial<AssumeRoleCommandOutput>
) {
	return mock.method(
		STSClient.prototype,
		'send',
		async (command: AssumeRoleCommand) => respond(command)
	);
}

function isSafeUnavailable(error: unknown): boolean {
	return (
		error instanceof ServiceUnavailableException &&
		!JSON.stringify(error.getResponse()).includes(INTERNAL_DETAIL)
	);
}

describe('ObjectStoragePushAccessService.getPushAccess', () => {
	afterEach(() => mock.restoreAll());

	it('returns temporary credentials scoped to the organization prefix', async () => {
		const send = stsResponds(() => ({
			Credentials: {
				AccessKeyId: 'key',
				SecretAccessKey: 'secret',
				SessionToken: 'token',
				Expiration: new Date(),
			},
		}));
		const access = await service().getPushAccess(ORGANIZATION_ID);
		assert.equal(access.accessKey, 'key');
		assert.equal(access.secret, 'secret');
		assert.equal(access.sessionToken, 'token');
		assert.equal(access.organizationId, ORGANIZATION_ID);
		assert.equal(access.bucket, BUCKET);
		const [command] = send.mock.calls[0]?.arguments ?? [];
		assert.ok(command instanceof AssumeRoleCommand);
		assert.equal(command.input.RoleArn, undefined);
		assert.match(
			command.input.Policy ?? '',
			new RegExp(`arn:aws:s3:::${BUCKET}/${ORGANIZATION_ID}/\\*`)
		);
	});

	it('hides the STS error behind a fixed unavailable error', async () => {
		stsResponds(() => {
			throw new Error(INTERNAL_DETAIL);
		});
		await assert.rejects(
			service().getPushAccess(ORGANIZATION_ID),
			isSafeUnavailable
		);
	});

	it('rejects an STS response without credentials', async () => {
		stsResponds(() => ({}));
		await assert.rejects(
			service().getPushAccess(ORGANIZATION_ID),
			isSafeUnavailable
		);
	});
});
