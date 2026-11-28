/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const UPLOAD_CREDENTIAL_LIFETIME_SECONDS = {
	BUILD_CONTEXT: 15 * SECONDS_PER_MINUTE,
	VOLUME_BACKUP_PACK: 12 * SECONDS_PER_HOUR,
} as const;

export const R2_UPLOAD_ACTIONS = [
	'PutObject',
	'CreateMultipartUpload',
	'UploadPart',
	'CompleteMultipartUpload',
	'AbortMultipartUpload',
] as const;

export const IAM_UPLOAD_ACTIONS = [
	's3:PutObject',
	's3:AbortMultipartUpload',
] as const;

export const IAM_POLICY_VERSION = '2012-10-17';
export const IAM_ALLOW_EFFECT = 'Allow';
export const S3_OBJECT_ARN_PREFIX = 'arn:aws:s3:::';
export const STS_MAXIMUM_ATTEMPTS = 3;
export const STS_SESSION_NAME_PREFIX = 'snapflow-upload';

export const R2_TEMPORARY_CREDENTIAL = {
	JWT_HEADER: { alg: 'HS256', typ: 'JWT' },
	HMAC_ALGORITHM: 'sha256',
	SECRET_DIGEST_ALGORITHM: 'sha256',
	SESSION_TOKEN_PREFIX: 'jwt/',
} as const;

export const UPLOAD_CREDENTIAL_UNAVAILABLE_MESSAGE =
	'Temporary upload credentials are unavailable right now. Try again in a few minutes.';
