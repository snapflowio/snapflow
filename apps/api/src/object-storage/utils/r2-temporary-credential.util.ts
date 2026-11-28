/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, createHmac } from 'node:crypto';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import {
	R2_TEMPORARY_CREDENTIAL,
	R2_UPLOAD_ACTIONS,
} from '../constants/object-storage-credential.constants';
import type {
	ObjectStorageCredential,
	ObjectUploadGrant,
	StaticObjectStorageCredential,
} from '../types/object-storage-credential.types';

export interface R2SigningContext {
	accountId: string;
	endpoint: string;
	bucket: string;
	parent: StaticObjectStorageCredential;
}

const encodeSegment = (value: object): string =>
	Buffer.from(JSON.stringify(value)).toString('base64url');

export function signR2UploadCredential(
	context: R2SigningContext,
	grant: ObjectUploadGrant,
	now: Date
): ObjectStorageCredential {
	const issuedAt = Math.floor(now.getTime() / MILLISECONDS_PER_SECOND);
	const expiresAt = issuedAt + grant.ttlSeconds;
	const unsigned = `${encodeSegment(R2_TEMPORARY_CREDENTIAL.JWT_HEADER)}.${encodeSegment(
		{
			bucket: context.bucket,
			actions: R2_UPLOAD_ACTIONS,
			paths: { prefixPaths: [], objectPaths: grant.keys },
			sub: context.accountId,
			iss: context.parent.accessKeyId,
			aud: new URL(context.endpoint).host,
			iat: issuedAt,
			exp: expiresAt,
		}
	)}`;
	const signature = createHmac(
		R2_TEMPORARY_CREDENTIAL.HMAC_ALGORITHM,
		context.parent.secretAccessKey
	)
		.update(unsigned)
		.digest('base64url');
	const jwt = `${unsigned}.${signature}`;
	return {
		accessKeyId: context.parent.accessKeyId,
		secretAccessKey: createHash(R2_TEMPORARY_CREDENTIAL.SECRET_DIGEST_ALGORITHM)
			.update(jwt)
			.digest('hex'),
		sessionToken: Buffer.from(
			`${R2_TEMPORARY_CREDENTIAL.SESSION_TOKEN_PREFIX}${jwt}`
		).toString('base64'),
		expiresAt: new Date(expiresAt * MILLISECONDS_PER_SECOND),
	};
}
